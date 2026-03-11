const sections = {
  A: {
    title: 'Emotional Distress',
    prompts: [
      { prompt: 'I feel emotionally exhausted by academic pressure.', reverse: false },
      { prompt: 'I struggle to manage sadness linked to my studies.', reverse: false },
      { prompt: 'I often feel overwhelmed by daily responsibilities.', reverse: false },
      { prompt: 'I worry excessively about my academic future.', reverse: false },
      { prompt: 'I feel tense even during ordinary school tasks.', reverse: false },
      { prompt: 'I find it hard to relax after academic setbacks.', reverse: false },
      { prompt: 'I feel hopeless when academic stress builds up.', reverse: false },
      { prompt: 'I lose motivation because of emotional strain.', reverse: false },
      { prompt: 'I feel mentally drained after attending classes.', reverse: false },
      { prompt: 'I find it difficult to regulate distressing emotions.', reverse: false }
    ]
  },
  B: {
    title: 'Academic Self Efficacy',
    prompts: [
      { prompt: 'I believe I can complete challenging coursework.', reverse: true },
      { prompt: 'I can recover after performing poorly in a test.', reverse: true },
      { prompt: 'I feel confident asking for academic help when needed.', reverse: true },
      { prompt: 'I can organize my study schedule effectively.', reverse: true },
      { prompt: 'I believe my effort improves my academic outcomes.', reverse: true },
      { prompt: 'I can stay focused during difficult learning periods.', reverse: true },
      { prompt: 'I trust my ability to solve academic problems.', reverse: true },
      { prompt: 'I can keep up with deadlines consistently.', reverse: true },
      { prompt: 'I feel capable of learning complex material.', reverse: true },
      { prompt: 'I can adapt when teaching methods change.', reverse: true }
    ]
  },
  C: {
    title: 'School Belongingness',
    prompts: [
      { prompt: 'I feel accepted within my educational environment.', reverse: true },
      { prompt: 'I have at least one trusted person at school or college.', reverse: true },
      { prompt: 'I feel included in classroom or campus activities.', reverse: true },
      { prompt: 'My institution feels like a supportive community.', reverse: true },
      { prompt: 'I feel comfortable expressing my concerns in class.', reverse: true },
      { prompt: 'I feel connected to my peers.', reverse: true },
      { prompt: 'I feel that faculty care about student wellbeing.', reverse: true },
      { prompt: 'I feel safe seeking support from my institution.', reverse: true },
      { prompt: 'I feel proud to belong to my institution.', reverse: true },
      { prompt: 'I feel isolated from the academic community.', reverse: false }
    ]
  },
  D: {
    title: 'Family Emotional Climate',
    prompts: [
      { prompt: 'My family understands the emotional demands of studying.', reverse: true },
      { prompt: 'I receive encouragement from home when stressed.', reverse: true },
      { prompt: 'Family conflict affects my concentration.', reverse: false },
      { prompt: 'I feel supported by family during academic pressure.', reverse: true },
      { prompt: 'I can discuss emotional challenges at home safely.', reverse: true },
      { prompt: 'My home environment helps me stay focused.', reverse: true },
      { prompt: 'Family expectations create intense pressure for me.', reverse: false },
      { prompt: 'I receive empathy from my family when I struggle.', reverse: true },
      { prompt: 'Family problems interfere with my academic routine.', reverse: false },
      { prompt: 'My family helps me cope with setbacks constructively.', reverse: true }
    ]
  },
  E: {
    title: 'Coping & Resilience',
    prompts: [
      { prompt: 'I use healthy coping strategies when stressed.', reverse: true },
      { prompt: 'I can calm myself during emotionally difficult moments.', reverse: true },
      { prompt: 'I recover quickly after setbacks.', reverse: true },
      { prompt: 'I know practical techniques to reduce stress.', reverse: true },
      { prompt: 'I can stay hopeful during challenging periods.', reverse: true },
      { prompt: 'I make time for rest and self-care.', reverse: true },
      { prompt: 'I can ask for emotional support when needed.', reverse: true },
      { prompt: 'I reflect on problems before reacting impulsively.', reverse: true },
      { prompt: 'I keep trying even when progress feels slow.', reverse: true },
      { prompt: 'I believe I can build stronger resilience over time.', reverse: true }
    ]
  }
};

const pfadsQuestions = Object.entries(sections).flatMap(([section, definition], sectionIndex) =>
  definition.prompts.map((item, promptIndex) => ({
    id: sectionIndex * 10 + promptIndex + 1,
    section,
    sectionTitle: definition.title,
    prompt: item.prompt,
    reverse: item.reverse
  }))
);

module.exports = pfadsQuestions;
