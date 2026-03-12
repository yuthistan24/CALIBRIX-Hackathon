module.exports = [
  {
    id: 1,
    key: 'mood',
    prompt: 'How are you feeling today?',
    type: 'single_choice',
    options: [
      { value: 'very_happy', label: 'Very happy' },
      { value: 'happy', label: 'Happy' },
      { value: 'neutral', label: 'Neutral' },
      { value: 'sad', label: 'Sad' },
      { value: 'very_sad', label: 'Very sad' }
    ]
  },
  {
    id: 2,
    key: 'stress',
    prompt: 'How stressed do you feel today?',
    type: 'single_choice',
    options: [
      { value: 'not_stressed', label: 'Not stressed' },
      { value: 'slightly_stressed', label: 'Slightly stressed' },
      { value: 'moderately_stressed', label: 'Moderately stressed' },
      { value: 'very_stressed', label: 'Very stressed' }
    ]
  },
  {
    id: 3,
    key: 'study_motivation',
    prompt: 'How motivated are you to study today?',
    type: 'single_choice',
    options: [
      { value: 'very_motivated', label: 'Very motivated' },
      { value: 'somewhat_motivated', label: 'Somewhat motivated' },
      { value: 'not_motivated', label: 'Not motivated' }
    ]
  },
  {
    id: 4,
    key: 'sleep_quality',
    prompt: 'How well did you sleep last night?',
    type: 'single_choice',
    options: [
      { value: 'very_well', label: 'Very well' },
      { value: 'average', label: 'Average' },
      { value: 'poor', label: 'Poor' }
    ]
  },
  {
    id: 5,
    key: 'energy_level',
    prompt: 'How energetic do you feel today?',
    type: 'single_choice',
    options: [
      { value: 'high_energy', label: 'High energy' },
      { value: 'normal_energy', label: 'Normal energy' },
      { value: 'low_energy', label: 'Low energy' }
    ]
  },
  {
    id: 6,
    key: 'academic_pressure',
    prompt: 'Did you feel pressure because of studies today?',
    type: 'single_choice',
    options: [
      { value: 'yes_a_lot', label: 'Yes, a lot' },
      { value: 'a_little', label: 'A little' },
      { value: 'not_at_all', label: 'Not at all' }
    ]
  },
  {
    id: 7,
    key: 'social_interaction',
    prompt: 'Did you talk or spend time with friends or family today?',
    type: 'single_choice',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    id: 8,
    key: 'anxiety',
    prompt: 'Did you feel worried or anxious today?',
    type: 'single_choice',
    options: [
      { value: 'not_at_all', label: 'Not at all' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' }
    ]
  },
  {
    id: 9,
    key: 'confidence',
    prompt: 'How confident do you feel about your studies today?',
    type: 'single_choice',
    options: [
      { value: 'very_confident', label: 'Very confident' },
      { value: 'somewhat_confident', label: 'Somewhat confident' },
      { value: 'not_confident', label: 'Not confident' }
    ]
  },
  {
    id: 10,
    key: 'biggest_challenge',
    prompt: 'What was the biggest challenge you faced today?',
    type: 'text',
    placeholder: 'Write your answer here'
  },
  {
    id: 11,
    key: 'giving_up',
    prompt: 'Did you feel like giving up on your studies today?',
    type: 'single_choice',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'no', label: 'No' }
    ],
    highlight: true
  }
];
