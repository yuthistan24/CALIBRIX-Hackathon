const dailyCheckinQuestions = require('../data/dailyCheckinQuestions');
const { QUESTIONNAIRE_SCALES, FULL_PFADS, getQuestionnaireById, getQuestionnaireSummaries } = require('../data/questionnaireCatalog');
const psychologists = require('../data/psychologists');
const scholarships = require('../data/scholarships');
const videoRecommendations = require('../data/videoRecommendations');
const miniGames = require('../data/miniGames');
const dailyTasks = require('../data/dailyTasks');
const hospitals = require('../data/hospitals');
const resilienceResources = require('../data/resilienceResources');
const asyncHandler = require('../utils/asyncHandler');
const { calculateQuestionnaireResult } = require('../utils/pfads');
const { getDateKey, calculateDailyCheckinMetrics } = require('../utils/dailyCheckin');
const Student = require('../models/Student');
const PfadsResponse = require('../models/PfadsResponse');
const PfadsScore = require('../models/PfadsScore');
const ClusterResult = require('../models/ClusterResult');
const PredictionResult = require('../models/PredictionResult');
const DailyCheckin = require('../models/DailyCheckin');
const Appointment = require('../models/Appointment');
const SentimentLog = require('../models/SentimentLog');
const ChatMessage = require('../models/ChatMessage');
const Alert = require('../models/Alert');
const TaskCompletion = require('../models/TaskCompletion');
const AssignedTask = require('../models/AssignedTask');
const DeviceSync = require('../models/DeviceSync');
const StudentIntroProfile = require('../models/StudentIntroProfile');
const { clusterPsychology, predictDropout, analyzeSentiment, generateChatResponse } = require('../services/aiService');
const { analyzeTranscriptWithLlm, getLlmRuntimeStatus, transcribeSpeech } = require('../services/llmService');
const { assignCounselor } = require('../services/counselorAssignmentService');
const { buildTaskSummary } = require('../services/taskInsightService');
const { identifyStudentNeeds } = require('../services/studentNeedsService');
const { buildStudentEvaluation } = require('../services/studentEvaluationService');
const { getSupportCopy } = require('../services/translationService');
const {
  findOrCreateAlert,
  evaluateAssessmentAlerts,
  evaluateSentimentAlerts,
  evaluateChatEscalationAlert,
  evaluateHolisticAlerts
} = require('../services/alertService');
const Counselor = require('../models/Counselor');

function recommendHospitals(district) {
  return hospitals.filter((entry) => entry.district === district || entry.district === 'Default');
}

function buildResilienceBadges(score, streak, badges) {
  const nextBadges = new Set(badges);
  if (score >= 20) {
    nextBadges.add('Grounded Starter');
  }
  if (streak >= 3) {
    nextBadges.add('Three Day Reset');
  }
  if (score >= 60) {
    nextBadges.add('Resilience Builder');
  }
  return Array.from(nextBadges);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value || 0)));
}

async function rollback(steps) {
  for (const step of steps.reverse()) {
    try {
      await step();
    } catch (_error) {
      // Best-effort cleanup for standalone MongoDB deployments.
    }
  }
}

async function getLatestStudentContext(studentId) {
  const [latestCheckin, latestPrediction, latestAppointment] = await Promise.all([
    DailyCheckin.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    Appointment.findOne({ student: studentId }).sort({ createdAt: -1 }).lean()
  ]);

  return {
    latestCheckin,
    latestPrediction,
    latestAppointment
  };
}

async function loadEvaluationInputs(studentId) {
  const [
    student,
    latestScore,
    latestPrediction,
    latestCheckin,
    sentiments,
    recentTaskCompletions,
    latestDeviceSync,
    latestIntroProfile,
    assignedTasks
  ] = await Promise.all([
    Student.findById(studentId).lean(),
    PfadsScore.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    DailyCheckin.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    SentimentLog.find({ student: studentId }).sort({ createdAt: -1 }).limit(20).lean(),
    TaskCompletion.find({ student: studentId }).sort({ createdAt: -1 }).limit(200).lean(),
    DeviceSync.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    StudentIntroProfile.findOne({ student: studentId }).sort({ createdAt: -1 }).lean(),
    AssignedTask.find({ student: studentId }).sort({ createdAt: -1 }).limit(20).lean()
  ]);

  return {
    student,
    latestScore,
    latestPrediction,
    latestCheckin,
    sentiments,
    recentTaskCompletions,
    latestDeviceSync,
    latestIntroProfile,
    assignedTasks
  };
}

async function evaluateHolisticStudentState({ studentId, counselorId, io }) {
  const inputs = await loadEvaluationInputs(studentId);
  const taskSummary = buildTaskSummary(inputs.recentTaskCompletions, inputs.assignedTasks);
  const evaluation = buildStudentEvaluation({
    ...inputs,
    taskSummary
  });

  await evaluateHolisticAlerts({
    studentId,
    counselorId,
    evaluation,
    io
  });

  return evaluation;
}

function getDeviceHooks() {
  return [
    { provider: 'Google Fit', hookType: 'google_fit', status: 'prototype hook available' },
    { provider: 'Apple Health', hookType: 'apple_health', status: 'prototype hook available' },
    { provider: 'Fitbit', hookType: 'fitbit', status: 'prototype hook available' },
    { provider: 'Wear OS', hookType: 'wear_os', status: 'prototype hook available' }
  ];
}

function recommendVideos(dominantRisk, latestCheckin) {
  const riskTagMap = {
    'Emotional Distress': 'emotional',
    'Academic Helplessness': 'academic',
    'Social Belonging Issues': 'social',
    'Family Stress Dominant': 'family',
    'Coping Resilience Deficit': 'coping'
  };

  const selectedTag = riskTagMap[dominantRisk] || 'emotional';
  const wellbeingTag = latestCheckin?.metrics?.riskLevel === 'High concern' ? 'anxiety' : selectedTag;

  const matches = videoRecommendations.filter(
    (video) => video.tags.includes(selectedTag) || video.tags.includes(wellbeingTag)
  );

  return matches.length ? matches : videoRecommendations.slice(0, 3);
}

function mapPsychologists(copy) {
  return psychologists.map((entry) => ({
    ...entry,
    addressLabel: copy.addressLabel,
    blogLabel: copy.blogLabel
  }));
}

async function evaluateShortAssessmentAlerts({ studentId, questionnaire, result, io }) {
  const alerts = [];

  if (questionnaire.type === 'pfads_section' && questionnaire.targetSection === 'A' && result.normalizedTotalScore >= 151) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        type: 'section_a_high_distress',
        severity: result.normalizedTotalScore >= 201 ? 'high' : 'moderate',
        title: 'Section A distress screening is elevated',
        description: 'The emotional distress section suggests the student may need closer support.',
        metadata: {
          questionnaireId: questionnaire.id,
          normalizedTotalScore: result.normalizedTotalScore
        },
        io
      })
    );
  }

  if (questionnaire.type === 'others' && result.normalizedTotalScore >= 151) {
    alerts.push(
      await findOrCreateAlert({
        studentId,
        type: 'others_screen_high_concern',
        severity: result.normalizedTotalScore >= 201 ? 'high' : 'moderate',
        title: 'Others wellbeing screening is elevated',
        description: 'The additional wellbeing screening suggests stress, exhaustion, or unsupported strain.',
        metadata: {
          questionnaireId: questionnaire.id,
          normalizedTotalScore: result.normalizedTotalScore
        },
        io
      })
    );
  }

  return alerts;
}

const getQuestions = asyncHandler(async (req, res) => {
  const selectedQuestionnaire = getQuestionnaireById(req.query.questionnaireId || FULL_PFADS.id);
  res.json({
    questionnaire: selectedQuestionnaire.sections.flatMap((section) => section.questions),
    selectedQuestionnaire,
    questionnaires: getQuestionnaireSummaries(),
    scale: QUESTIONNAIRE_SCALES[selectedQuestionnaire.scaleKey] || QUESTIONNAIRE_SCALES.agreement,
    scales: QUESTIONNAIRE_SCALES
  });
});

const getDailyCheckinQuestions = asyncHandler(async (_req, res) => {
  res.json({
    questionnaire: dailyCheckinQuestions
  });
});

const getTodayDailyCheckin = asyncHandler(async (req, res) => {
  const todayCheckin = await DailyCheckin.findOne({
    student: req.user.userId,
    dateKey: getDateKey()
  }).lean();

  res.json({
    checkin: todayCheckin
  });
});

const submitDailyCheckin = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const responses = {
    mood: req.body.mood,
    stress: req.body.stress,
    study_motivation: req.body.study_motivation,
    sleep_quality: req.body.sleep_quality,
    energy_level: req.body.energy_level,
    academic_pressure: req.body.academic_pressure,
    social_interaction: req.body.social_interaction,
    anxiety: req.body.anxiety,
    confidence: req.body.confidence,
    biggest_challenge: String(req.body.biggest_challenge || '').trim(),
    giving_up: req.body.giving_up
  };

  const challengeSentiment = await analyzeSentiment(responses.biggest_challenge);
  const metrics = calculateDailyCheckinMetrics(responses, challengeSentiment);
  const dateKey = getDateKey();

  const checkin = await DailyCheckin.findOneAndUpdate(
    {
      student: student._id,
      dateKey
    },
    {
      student: student._id,
      dateKey,
      responses,
      metrics,
      challengeSentiment
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true
    }
  );

  await SentimentLog.create({
    student: student._id,
    sourceType: 'daily_checkin',
    message: responses.biggest_challenge,
    sentimentScore: challengeSentiment.score,
    label: challengeSentiment.label,
    stressIndicator: challengeSentiment.stressIndicator
  });

  student.latestSentimentScore = challengeSentiment.score;
  student.historicalEngagement = Math.min(1, Number((student.historicalEngagement * 0.85 + 0.15).toFixed(2)));
  await student.save();

  const io = req.app.get('io');
  await evaluateSentimentAlerts({
    studentId: student._id,
    sentiment: challengeSentiment,
    sourceType: 'daily_checkin',
    messageText: responses.biggest_challenge,
    io
  });

  if (responses.giving_up === 'yes' || metrics.riskLevel === 'High concern') {
    await findOrCreateAlert({
      studentId: student._id,
      type: 'daily_checkin_high_concern',
      severity: 'high',
      title: 'High concern daily check-in',
      description: 'Daily check-in indicates acute psychological strain or thoughts of giving up studies.',
      metadata: {
        dateKey,
        riskLevel: metrics.riskLevel,
        flags: metrics.flags
      },
      io
    });
  } else if (responses.giving_up === 'sometimes' || metrics.riskLevel === 'Moderate concern') {
    await findOrCreateAlert({
      studentId: student._id,
      type: 'daily_checkin_moderate_concern',
      severity: 'moderate',
      title: 'Moderate concern daily check-in',
      description: 'Daily check-in suggests the student may need closer monitoring.',
      metadata: {
        dateKey,
        riskLevel: metrics.riskLevel,
        flags: metrics.flags
      },
      io
    });
  }

  await evaluateHolisticStudentState({
    studentId: student._id,
    io
  });

  res.status(201).json({
    message: 'Daily check-in saved',
    checkin
  });
});

const completeDailyTask = asyncHandler(async (req, res) => {
  const task = dailyTasks.find((entry) => entry.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ message: 'Task not found' });
  }

  const durationSeconds = Number(req.body.durationSeconds || task.estimatedMinutes * 60);

  const completion = await TaskCompletion.create({
    student: req.user.userId,
    taskId: task.id,
    taskTitle: task.title,
    category: task.category,
    sourceType: task.id === 'task-mini-game' ? 'mini_game' : 'daily',
    dateKey: getDateKey(),
    durationSeconds,
    varianceFromEstimateSeconds: durationSeconds - task.estimatedMinutes * 60,
    completionNotes: String(req.body.notes || '').trim()
  });

  const student = await Student.findById(req.user.userId);
  if (student) {
    student.historicalEngagement = Math.min(1, Number((student.historicalEngagement * 0.85 + 0.15).toFixed(2)));
    await student.save();
  }

  const recentCompletions = await TaskCompletion.find({ student: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const assignedTasks = await AssignedTask.find({ student: req.user.userId }).sort({ createdAt: -1 }).limit(20).lean();
  const summary = buildTaskSummary(recentCompletions, assignedTasks);

  await evaluateHolisticStudentState({
    studentId: req.user.userId,
    io: req.app.get('io')
  });

  res.status(201).json({
    message: 'Task completion logged',
    completion,
    summary
  });
});

const completeAssignedTask = asyncHandler(async (req, res) => {
  const assignedTask = await AssignedTask.findOne({
    _id: req.params.taskId,
    student: req.user.userId
  });

  if (!assignedTask) {
    return res.status(404).json({ message: 'Assigned task not found' });
  }

  if (['completed', 'cancelled'].includes(assignedTask.status)) {
    return res.status(400).json({ message: 'This assigned task is already closed' });
  }

  const durationSeconds = Number(req.body.durationSeconds || assignedTask.estimatedMinutes * 60);
  assignedTask.status = 'completed';
  assignedTask.completedAt = new Date();
  assignedTask.completionNotes = String(req.body.notes || '').trim();
  await assignedTask.save();

  const completion = await TaskCompletion.create({
    student: req.user.userId,
    counselor: assignedTask.counselor,
    assignedTask: assignedTask._id,
    taskId: `assigned:${assignedTask._id.toString()}`,
    taskTitle: assignedTask.title,
    category: assignedTask.category,
    sourceType: 'assigned',
    dateKey: getDateKey(),
    durationSeconds,
    varianceFromEstimateSeconds: durationSeconds - assignedTask.estimatedMinutes * 60,
    completionNotes: assignedTask.completionNotes
  });

  const io = req.app.get('io');
  if (io && assignedTask.counselor) {
    io.to(`user:${assignedTask.counselor.toString()}`).emit('tasks:completed', {
      assignedTaskId: assignedTask._id,
      studentId: req.user.userId
    });
  }

  const recentCompletions = await TaskCompletion.find({ student: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const assignedTasks = await AssignedTask.find({ student: req.user.userId }).sort({ createdAt: -1 }).limit(20).lean();
  const summary = buildTaskSummary(recentCompletions, assignedTasks);

  await evaluateHolisticStudentState({
    studentId: req.user.userId,
    counselorId: assignedTask.counselor,
    io
  });

  res.status(201).json({
    message: 'Assigned task marked complete',
    completion,
    assignedTask,
    summary
  });
});

const syncDeviceMetrics = asyncHandler(async (req, res) => {
  const payload = {
    student: req.user.userId,
    source: req.body.source || 'Manual device sync',
    hookType: req.body.hookType || 'manual',
    sessionId: req.body.sessionId || null,
    screenName: req.body.screenName || '',
    dateKey: req.body.dateKey || getDateKey(),
    steps: Number(req.body.steps || 0),
    sleepHours: Number(req.body.sleepHours || 0),
    focusMinutes: Number(req.body.focusMinutes || 0),
    screenTimeMinutes: Number(req.body.screenTimeMinutes || 0),
    activeMinutes: Number(req.body.activeMinutes || 0),
    idleMinutes: Number(req.body.idleMinutes || 0),
    studyScreenMinutes: Number(req.body.studyScreenMinutes || 0),
    activityScore: Number(req.body.activityScore || 0),
    notes: req.body.notes || '',
    sourceMeta: req.body.sourceMeta || {}
  };

  const sync =
    payload.hookType === 'web_session' && payload.sessionId
      ? await DeviceSync.findOneAndUpdate(
          {
            student: req.user.userId,
            hookType: payload.hookType,
            sessionId: payload.sessionId
          },
          payload,
          {
            new: true,
            upsert: true,
            runValidators: true,
            setDefaultsOnInsert: true
          }
        )
      : await DeviceSync.create(payload);

  await Student.updateOne(
    { _id: req.user.userId },
    {
      $set: {
        historicalEngagement: Math.min(
          1,
          Number(
            (
              clamp(payload.focusMinutes / 120, 0, 1) * 0.45 +
              clamp(payload.studyScreenMinutes / 120, 0, 1) * 0.25 +
              clamp(payload.steps / 8000, 0, 1) * 0.15 +
              clamp((8 - Math.max(0, 8 - payload.sleepHours)) / 8, 0, 1) * 0.15
            ).toFixed(2)
          )
        )
      }
    }
  );

  const evaluation = await evaluateHolisticStudentState({
    studentId: req.user.userId,
    io: req.app.get('io')
  });

  res.status(201).json({
    message: 'Device metrics synced',
    sync,
    evaluation
  });
});

const analyzeSelfIntroduction = asyncHandler(async (req, res) => {
  const transcript = String(req.body.transcript || '').trim();
  const durationSeconds = Number(req.body.durationSeconds || 0);
  const language = String(req.body.language || 'English').trim();

  if (!transcript) {
    return res.status(400).json({ message: 'Transcript is required' });
  }

  if (durationSeconds > 180) {
    return res.status(400).json({ message: 'Self-introduction must be 3 minutes or less' });
  }

  const analysis =
    (await analyzeTranscriptWithLlm({
      transcript,
      language
    })) || identifyStudentNeeds(transcript);
  const profile = await StudentIntroProfile.create({
    student: req.user.userId,
    transcript,
    durationSeconds,
    needs: analysis.needs,
    summary: analysis.summary,
    urgency: analysis.urgency
  });

  if (analysis.urgency === 'high') {
    await findOrCreateAlert({
      studentId: req.user.userId,
      type: 'self_intro_high_need',
      severity: 'high',
      title: 'High-need self introduction detected',
      description: 'Voice introduction analysis indicates urgent support needs.',
      metadata: analysis,
      io: req.app.get('io')
    });
  }

  await evaluateHolisticStudentState({
    studentId: req.user.userId,
    io: req.app.get('io')
  });

  res.status(201).json({
    message: 'Self-introduction analyzed',
    profile,
    analysisSource: {
      provider: analysis.provider || 'heuristic',
      model: analysis.model || 'mindguard-keyword'
    }
  });
});

const getAiRuntime = asyncHandler(async (_req, res) => {
  const runtime = await getLlmRuntimeStatus();
  res.json({ runtime });
});

const transcribeVoiceMessage = asyncHandler(async (req, res) => {
  const audioBase64 = String(req.body.audioBase64 || '').trim();
  const mimeType = String(req.body.mimeType || 'audio/webm').trim();
  const filename = String(req.body.filename || 'voice-message.webm').trim();
  const language = String(req.body.language || 'en').trim();

  if (!audioBase64) {
    return res.status(400).json({ message: 'Audio payload is required' });
  }

  const transcription = await transcribeSpeech({
    audioBase64,
    mimeType,
    filename,
    language
  });

  if (!transcription?.text) {
    return res.status(400).json({
      message:
        'Voice transcription is not available. Configure an OpenAI or compatible transcription provider, or use browser speech recognition.'
    });
  }

  res.json({
    message: 'Voice message transcribed',
    transcription
  });
});

const submitAssessment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const questionnaire = getQuestionnaireById(req.body.questionnaireId || FULL_PFADS.id);
  const answers = req.body.answers;
  const assessmentResult = calculateQuestionnaireResult(questionnaire.id, answers);

  if (questionnaire.type !== 'pfads_full') {
    const responseDoc = await PfadsResponse.create({
      student: student._id,
      questionnaireId: questionnaire.id,
      questionnaireTitle: questionnaire.title,
      questionnaireType: questionnaire.type,
      answers,
      summary: {
        totalScore: assessmentResult.totalScore,
        normalizedTotalScore: assessmentResult.normalizedTotalScore,
        riskLevel: assessmentResult.riskLevel,
        sectionScores: assessmentResult.sectionScores
      }
    });

    if (questionnaire.type === 'pfads_section' && questionnaire.targetSection) {
      const sectionRiskMap = {
        A: 'Emotional Distress',
        B: 'Academic Helplessness',
        C: 'Social Belonging Issues',
        D: 'Family Stress Dominant',
        E: 'Coping Resilience Deficit'
      };
      if (assessmentResult.normalizedTotalScore >= 151) {
        student.dominantRisk = sectionRiskMap[questionnaire.targetSection] || student.dominantRisk;
        await student.save();
      }
    }

    await evaluateShortAssessmentAlerts({
      studentId: student._id,
      questionnaire,
      result: assessmentResult,
      io: req.app.get('io')
    });
    await evaluateHolisticStudentState({
      studentId: student._id,
      io: req.app.get('io')
    });

    return res.status(201).json({
      message: `${questionnaire.title} submitted successfully`,
      assessmentType: questionnaire.type,
      questionnaire: {
        id: questionnaire.id,
        title: questionnaire.title
      },
      response: responseDoc,
      score: {
        totalScore: assessmentResult.totalScore,
        normalizedTotalScore: assessmentResult.normalizedTotalScore,
        sectionScores: assessmentResult.sectionScores,
        riskLevel: assessmentResult.riskLevel
      },
      cluster: null,
      prediction: null
    });
  }

  const pfads = assessmentResult;
  const cluster = await clusterPsychology(pfads.sectionScores);
  const prediction = await predictDropout({
    totalScore: pfads.totalScore,
    sectionScores: pfads.sectionScores,
    sentimentScore: student.latestSentimentScore || 0,
    historicalEngagement: student.historicalEngagement,
    assessmentCompletionPatterns: student.assessmentCompletionPatterns
  });

  let responseDoc;
  let scoreDoc;
  let clusterDoc;
  let predictionDoc;
  const rollbackSteps = [];

  try {
    responseDoc = await PfadsResponse.create({
      student: student._id,
      questionnaireId: questionnaire.id,
      questionnaireTitle: questionnaire.title,
      questionnaireType: questionnaire.type,
      answers,
      summary: {
        totalScore: pfads.totalScore,
        riskLevel: pfads.riskLevel,
        sectionScores: pfads.sectionScores
      }
    });
    rollbackSteps.push(() => PfadsResponse.deleteOne({ _id: responseDoc._id }));

    scoreDoc = await PfadsScore.create({
      student: student._id,
      response: responseDoc._id,
      questionnaireId: questionnaire.id,
      totalScore: pfads.totalScore,
      sectionScores: pfads.sectionScores,
      riskLevel: pfads.riskLevel
    });
    rollbackSteps.push(() => PfadsScore.deleteOne({ _id: scoreDoc._id }));

    clusterDoc = await ClusterResult.create({
      student: student._id,
      pfadsScore: scoreDoc._id,
      clusterId: cluster.clusterId,
      clusterLabel: cluster.clusterLabel,
      dominantFactor: cluster.dominantFactor,
      rankedFactors: cluster.rankedFactors,
      centroidDistances: cluster.centroidDistances
    });
    rollbackSteps.push(() => ClusterResult.deleteOne({ _id: clusterDoc._id }));

    predictionDoc = await PredictionResult.create({
      student: student._id,
      pfadsScore: scoreDoc._id,
      probability: prediction.probability,
      riskLevel: prediction.riskLevel,
      featureSnapshot: {
        sentimentScore: student.latestSentimentScore || 0,
        historicalEngagement: student.historicalEngagement,
        assessmentCompletionPatterns: student.assessmentCompletionPatterns
      }
    });
    rollbackSteps.push(() => PredictionResult.deleteOne({ _id: predictionDoc._id }));

    student.lastAssessmentAt = new Date();
    student.dominantRisk = cluster.dominantFactor;
    await student.save();
  } catch (error) {
    await rollback(rollbackSteps);
    throw error;
  }

  const io = req.app.get('io');
  const latestAppointment = await Appointment.findOne({ student: student._id }).sort({ createdAt: -1 }).lean();
  await evaluateAssessmentAlerts({
    studentId: student._id,
    counselorId: latestAppointment?.counselor,
    pfadsScore: scoreDoc,
    prediction,
    io
  });
  await evaluateHolisticStudentState({
    studentId: student._id,
    counselorId: latestAppointment?.counselor,
    io
  });

  res.status(201).json({
    message: 'PFADS assessment submitted successfully',
    score: scoreDoc,
    cluster: clusterDoc,
    prediction: predictionDoc
  });
});

const getDashboard = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId).lean();
  const language = req.query.lang || 'en';
  const [
    supportCopy,
    latestScore,
    latestCluster,
    latestPrediction,
    latestCheckin,
    recentCheckins,
    appointments,
    sentiments,
    alerts,
    recentTaskCompletions,
    latestDeviceSync,
    latestIntroProfile,
    assignedTasks
  ] = await Promise.all([
    getSupportCopy(language),
    PfadsScore.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    ClusterResult.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    PredictionResult.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    DailyCheckin.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    DailyCheckin.find({ student: student._id }).sort({ createdAt: -1 }).limit(7).lean(),
    Appointment.find({ student: student._id })
      .populate('counselor', 'name specialization district email mobileNumber hospitalOrClinic')
      .sort({ createdAt: -1 })
      .lean(),
    SentimentLog.find({ student: student._id }).sort({ createdAt: -1 }).limit(30).lean(),
    Alert.find({ student: student._id, resolved: false }).sort({ createdAt: -1 }).lean(),
    TaskCompletion.find({ student: student._id }).sort({ createdAt: -1 }).limit(200).lean(),
    DeviceSync.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    StudentIntroProfile.findOne({ student: student._id }).sort({ createdAt: -1 }).lean(),
    AssignedTask.find({ student: student._id })
      .populate('counselor', 'name email mobileNumber')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean()
  ]);
  const taskSummary = buildTaskSummary(recentTaskCompletions, assignedTasks);
  const evaluation = buildStudentEvaluation({
    student,
    latestScore,
    latestPrediction,
    latestCheckin,
    sentiments,
    taskSummary,
    latestDeviceSync,
    latestIntroProfile,
    assignedTasks
  });

  const mentorAppointment = appointments[0] || null;
  const mentorCounselor = mentorAppointment?.counselor
    ? {
        ...mentorAppointment.counselor,
        mentorMessage: 'Your counsellor is positioned here as a mentor figure for guidance and steady check-ins.',
        chatRoomId: `student:${student._id}:counselor:${mentorAppointment.counselor._id}`
      }
    : null;

  res.json({
    student,
    supportCopy,
    latestScore,
    latestCluster,
    latestPrediction,
    latestCheckin,
    recentCheckins: recentCheckins.reverse(),
    mentorCounselor,
    appointments,
    sentiments,
    alerts,
    resilienceResources,
    dailyCheckinQuestions,
    psychologists: mapPsychologists(supportCopy),
    scholarships,
    taskSummary,
    evaluation,
    personalizedVideos: recommendVideos(latestCluster?.dominantFactor || student.dominantRisk, latestCheckin),
    miniGames,
    deviceIntegration: {
      latestSync: latestDeviceSync,
      hooks: getDeviceHooks()
    },
    latestIntroProfile,
    hospitalRecommendations: recommendHospitals(student.district)
  });
});

const requestAppointment = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const specializationNeed = req.body.specializationNeed || student.dominantRisk;
  const counselor = await assignCounselor({
    specializationNeed,
    district: student.district
  });

  let appointment;
  let incrementedCounselor = false;
  try {
    appointment = await Appointment.create({
      student: student._id,
      counselor: counselor._id,
      specializationNeed,
      district: student.district,
      preferredDate: new Date(req.body.preferredDate),
      notes: req.body.notes || ''
    });

    await Counselor.updateOne({ _id: counselor._id }, { $inc: { activeSessions: 1 } });
    incrementedCounselor = true;
  } catch (error) {
    if (appointment?._id) {
      await Appointment.deleteOne({ _id: appointment._id }).catch(() => {});
    }
    if (incrementedCounselor) {
      await Counselor.updateOne(
        { _id: counselor._id, activeSessions: { $gt: 0 } },
        { $inc: { activeSessions: -1 } }
      ).catch(() => {});
    }
    throw error;
  }

  const io = req.app.get('io');
  if (io) {
    io.to(`user:${counselor._id.toString()}`).emit('appointments:new', appointment);
  }

  res.status(201).json({
    message: 'Counseling request assigned successfully',
    appointment,
    counselor
  });
});

const getResources = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId).lean();
  res.json({
    resilienceResources,
    hospitalRecommendations: recommendHospitals(student.district)
  });
});

const postAiChat = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const message = String(req.body.message || '').trim();
  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const roomId = `ai:${student._id.toString()}`;
  const [sentiment, recentMessages, latestContext] = await Promise.all([
    analyzeSentiment(message),
    ChatMessage.find({ roomId }).sort({ createdAt: -1 }).limit(6).lean(),
    getLatestStudentContext(student._id)
  ]);

  const chatReply = await generateChatResponse({
    message,
    language: req.body.language || 'English',
    chatHistory: recentMessages
      .reverse()
      .map((entry) => ({
        role: entry.senderRole === 'student' ? 'student' : 'assistant',
        message: entry.message
      })),
    studentContext: {
      dominantRisk: student.dominantRisk,
      district: student.district,
      latestCheckinRisk: latestContext.latestCheckin?.metrics?.riskLevel || null,
      latestCheckinFlags: latestContext.latestCheckin?.metrics?.flags || [],
      latestCheckinWellbeing: latestContext.latestCheckin?.metrics?.wellbeingScore ?? null,
      dropoutRisk: latestContext.latestPrediction?.riskLevel || null
    }
  });

  await Promise.all([
    ChatMessage.create({
      roomId,
      student: student._id,
      senderRole: 'student',
      senderId: student._id.toString(),
      recipientId: 'ai-assistant',
      message,
      sentiment
    }),
    ChatMessage.create({
      roomId,
      student: student._id,
      senderRole: 'ai',
      senderId: 'ai-assistant',
      recipientId: student._id.toString(),
      message: chatReply.reply
    }),
    SentimentLog.create({
      student: student._id,
      sourceType: 'ai_chat',
      message,
      sentimentScore: sentiment.score,
      label: sentiment.label,
      stressIndicator: sentiment.stressIndicator
    })
  ]);

  student.latestSentimentScore = sentiment.score;
  await student.save();

  const io = req.app.get('io');
  await evaluateSentimentAlerts({
    studentId: student._id,
    counselorId: latestContext.latestAppointment?.counselor,
    sentiment,
    sourceType: 'ai_chat',
    messageText: message,
    io
  });

  await evaluateChatEscalationAlert({
    studentId: student._id,
    counselorId: latestContext.latestAppointment?.counselor,
    chatReply,
    studentMessage: message,
    io
  });
  await evaluateHolisticStudentState({
    studentId: student._id,
    counselorId: latestContext.latestAppointment?.counselor,
    io
  });

  res.json({
    sentiment,
    chat: chatReply
  });
});

const clearAiChatHistory = asyncHandler(async (req, res) => {
  const roomId = `ai:${req.user.userId.toString()}`;
  await ChatMessage.deleteMany({
    roomId,
    student: req.user.userId
  });

  res.json({
    message: 'AI chat history cleared'
  });
});

const updateResilienceProgress = asyncHandler(async (req, res) => {
  const student = await Student.findById(req.user.userId);
  const resource = resilienceResources.find((entry) => entry.id === req.body.activityId);
  if (!resource) {
    return res.status(404).json({ message: 'Activity not found' });
  }

  const now = new Date();
  const lastActivity = student.lastResilienceActivityAt ? new Date(student.lastResilienceActivityAt) : null;
  const isConsecutiveDay =
    lastActivity && Math.floor((now - lastActivity) / (1000 * 60 * 60 * 24)) === 1;

  student.dailyResilienceScore = Math.min(100, student.dailyResilienceScore + resource.points);
  student.resilienceStreak = isConsecutiveDay ? student.resilienceStreak + 1 : Math.max(student.resilienceStreak, 1);
  student.lastResilienceActivityAt = now;
  student.achievementBadges = buildResilienceBadges(
    student.dailyResilienceScore,
    student.resilienceStreak,
    student.achievementBadges
  );
  await student.save();

  res.json({
    message: 'Resilience progress updated',
    dailyResilienceScore: student.dailyResilienceScore,
    resilienceStreak: student.resilienceStreak,
    achievementBadges: student.achievementBadges
  });
});

const getEmotionTimeline = asyncHandler(async (req, res) => {
  const sentiments = await SentimentLog.find({ student: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();
  res.json({
    sentiments: sentiments.reverse()
  });
});

module.exports = {
  getQuestions,
  getDailyCheckinQuestions,
  getTodayDailyCheckin,
  submitDailyCheckin,
  completeDailyTask,
  completeAssignedTask,
  syncDeviceMetrics,
  getAiRuntime,
  analyzeSelfIntroduction,
  transcribeVoiceMessage,
  submitAssessment,
  getDashboard,
  requestAppointment,
  getResources,
  postAiChat,
  clearAiChatHistory,
  updateResilienceProgress,
  getEmotionTimeline
};
