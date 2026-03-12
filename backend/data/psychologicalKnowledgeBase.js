module.exports = [
  {
    id: 'stress-regulation',
    title: 'Stress regulation',
    keywords: ['stress', 'overwhelmed', 'pressure', 'deadline', 'burden'],
    guidance:
      'When stress spikes, reduce body arousal first, then return to the academic problem. Short breathing cycles, posture reset, and one narrowed next step usually work better than forcing productivity.',
    supportSteps: [
      'Take three slow breaths with a longer exhale than inhale.',
      'Shrink the task to one visible five-to-ten minute action.',
      'Delay self-criticism until after the small action is complete.'
    ],
    escalationSignals: ['cannot cope', 'panic all day', 'shut down completely']
  },
  {
    id: 'anxiety-grounding',
    title: 'Anxiety grounding',
    keywords: ['anxious', 'panic', 'worry', 'worried', 'fear', 'overthinking'],
    guidance:
      'Anxiety usually needs grounding before problem solving. Naming the feared outcome, testing it against evidence, and returning attention to the present can lower the spiral.',
    supportSteps: [
      'Name the main feared outcome in one sentence.',
      'List one realistic and one unlikely outcome.',
      'Use a 5-4-3-2-1 grounding scan.'
    ],
    escalationSignals: ['panic attacks', 'cannot breathe', 'constant fear']
  },
  {
    id: 'low-mood',
    title: 'Low mood and hopelessness',
    keywords: ['sad', 'hopeless', 'empty', 'down', 'depressed', 'crying'],
    guidance:
      'Low mood often improves when pressure is reduced, connection is reintroduced, and the next demand is made smaller. Action should be gentle, concrete, and not perfection-based.',
    supportSteps: [
      'Rate mood intensity from 1 to 10.',
      'Choose one low-effort action that adds structure to the next hour.',
      'Reach out to one trusted person with a simple update.'
    ],
    escalationSignals: ['want to die', 'self harm', 'give up everything']
  },
  {
    id: 'sleep-energy',
    title: 'Sleep and energy recovery',
    keywords: ['sleep', 'tired', 'exhausted', 'fatigue', 'energy'],
    guidance:
      'Low sleep and low energy reduce concentration, mood stability, and confidence. The immediate goal is pacing, not pretending energy is normal.',
    supportSteps: [
      'Lower the difficulty of the next task.',
      'Use one timed study block with a defined stop point.',
      'Protect a recovery break before the next mentally heavy activity.'
    ],
    escalationSignals: ['no sleep for days', 'faint', 'severe exhaustion']
  },
  {
    id: 'study-burnout',
    title: 'Study burnout and disengagement',
    keywords: ['motivation', 'not motivated', 'burnout', 'burned out', 'procrastination', 'stuck'],
    guidance:
      'Burnout is better handled by reducing friction, clarifying the first step, and restoring a sense of control than by adding shame or intensity.',
    supportSteps: [
      'Pick the smallest academic task that still counts as progress.',
      'Work for one timer block only.',
      'Record what blocked progress before forcing another block.'
    ],
    escalationSignals: ['stopped all work', 'avoid campus completely', 'giving up studies']
  },
  {
    id: 'social-isolation',
    title: 'Isolation and belonging',
    keywords: ['alone', 'lonely', 'isolated', 'friends', 'belong', 'ignored'],
    guidance:
      'Isolation intensifies emotional strain and academic dropout risk. Reconnection should start with the safest low-pressure contact, not the most difficult conversation.',
    supportSteps: [
      'Message one trusted person or mentor.',
      'Choose one low-stakes social interaction today.',
      'Avoid interpreting silence as proof of rejection.'
    ],
    escalationSignals: ['no one cares', 'completely alone', 'nobody would notice']
  },
  {
    id: 'family-conflict',
    title: 'Family pressure and conflict',
    keywords: ['family', 'parents', 'home', 'conflict', 'mother', 'father'],
    guidance:
      'Family strain can disrupt study consistency and emotional safety. Helpful responses usually combine boundaries, planning around conflict windows, and support from someone outside the conflict.',
    supportSteps: [
      'Identify one quieter study window or space.',
      'Separate what you can control this evening from what you cannot.',
      'Use one calm sentence to ask for time or space.'
    ],
    escalationSignals: ['unsafe at home', 'violence', 'threatened']
  },
  {
    id: 'crisis-safety',
    title: 'Crisis safety',
    keywords: ['suicide', 'self harm', 'kill myself', 'hurt myself', 'die'],
    guidance:
      'When immediate safety language appears, the conversation must prioritize human follow-up, emergency support, and staying connected to a real person.',
    supportSteps: [
      'Move the conversation toward immediate human support.',
      'Encourage contacting a counselor, helpline, trusted adult, or emergency service now.',
      'Do not leave the student with only self-help suggestions.'
    ],
    escalationSignals: ['immediate danger', 'plan', 'means available']
  }
];
