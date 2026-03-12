const axios = require('axios');

const env = require('../config/env');

const FALLBACK_COPY = {
  en: {
    languageLabel: 'Language',
    psychologistDirectory: 'Psychologist Directory',
    blogLabel: 'Open Blog',
    addressLabel: 'Address',
    assignedMentor: 'Assigned Mentor',
    scholarshipSupport: 'Scholarship Support',
    dailyTasks: 'Daily Tasks',
    taskStreak: 'Task Streak',
    completionVariance: 'Completion Variance',
    miniGames: 'Mini Games',
    personalizedVideos: 'Personalized Videos',
    deviceIntegration: 'Device Integration',
    voiceIntroduction: 'Voice Introduction'
  },
  hi: {
    languageLabel: 'भाषा',
    psychologistDirectory: 'मनोवैज्ञानिक निर्देशिका',
    blogLabel: 'ब्लॉग खोलें',
    addressLabel: 'पता',
    assignedMentor: 'नियुक्त मेंटर',
    scholarshipSupport: 'छात्रवृत्ति सहायता',
    dailyTasks: 'दैनिक कार्य',
    taskStreak: 'कार्य स्ट्रीक',
    completionVariance: 'पूर्णता विविधता',
    miniGames: 'मिनी गेम्स',
    personalizedVideos: 'व्यक्तिगत वीडियो',
    deviceIntegration: 'डिवाइस एकीकरण',
    voiceIntroduction: 'वॉइस परिचय'
  },
  bn: {
    languageLabel: 'ভাষা',
    psychologistDirectory: 'মনোবিজ্ঞানী ডিরেক্টরি',
    blogLabel: 'ব্লগ খুলুন',
    addressLabel: 'ঠিকানা',
    assignedMentor: 'নির্ধারিত মেন্টর',
    scholarshipSupport: 'স্কলারশিপ সহায়তা',
    dailyTasks: 'দৈনিক কাজ',
    taskStreak: 'কাজের স্ট্রিক',
    completionVariance: 'সময় ভিন্নতা',
    miniGames: 'মিনি গেমস',
    personalizedVideos: 'ব্যক্তিগত ভিডিও',
    deviceIntegration: 'ডিভাইস ইন্টিগ্রেশন',
    voiceIntroduction: 'ভয়েস পরিচিতি'
  },
  te: {
    languageLabel: 'భాష',
    psychologistDirectory: 'సైకాలజిస్ట్ డైరెక్టరీ',
    blogLabel: 'బ్లాగ్ తెరవండి',
    addressLabel: 'చిరునామా',
    assignedMentor: 'కేటాయించిన మెంటర్',
    scholarshipSupport: 'విద్యార్థి వేతన సహాయం',
    dailyTasks: 'దినసరి పనులు',
    taskStreak: 'టాస్క్ స్ట్రీక్',
    completionVariance: 'పూర్తి సమయ వ్యత్యాసం',
    miniGames: 'మినీ గేమ్స్',
    personalizedVideos: 'వ్యక్తిగత వీడియోలు',
    deviceIntegration: 'పరికర అనుసంధానం',
    voiceIntroduction: 'వాయిస్ పరిచయం'
  },
  mr: {
    languageLabel: 'भाषा',
    psychologistDirectory: 'मनोवैज्ञानिक निर्देशिका',
    blogLabel: 'ब्लॉग उघडा',
    addressLabel: 'पत्ता',
    assignedMentor: 'नियुक्त मार्गदर्शक',
    scholarshipSupport: 'शिष्यवृत्ती मदत',
    dailyTasks: 'दैनंदिन कामे',
    taskStreak: 'कार्य सलगता',
    completionVariance: 'पूर्णत्व वेळ फरक',
    miniGames: 'मिनी गेम्स',
    personalizedVideos: 'वैयक्तिक व्हिडिओ',
    deviceIntegration: 'डिव्हाइस एकत्रीकरण',
    voiceIntroduction: 'आवाज परिचय'
  },
  ta: {
    languageLabel: 'மொழி',
    psychologistDirectory: 'மனையியல் நிபுணர் அடைவு',
    blogLabel: 'வலைப்பதிவு திறக்க',
    addressLabel: 'முகவரி',
    assignedMentor: 'ஒதுக்கப்பட்ட வழிகாட்டி',
    scholarshipSupport: 'உதவித்தொகை ஆதரவு',
    dailyTasks: 'தினசரி பணிகள்',
    taskStreak: 'பணி தொடர்',
    completionVariance: 'நேர மாறுபாடு',
    miniGames: 'மினி விளையாட்டுகள்',
    personalizedVideos: 'தனிப்பயன் வீடியோக்கள்',
    deviceIntegration: 'சாதன இணைப்பு',
    voiceIntroduction: 'குரல் அறிமுகம்'
  },
  ur: {
    languageLabel: 'زبان',
    psychologistDirectory: 'ماہرِ نفسیات ڈائریکٹری',
    blogLabel: 'بلاگ کھولیں',
    addressLabel: 'پتہ',
    assignedMentor: 'مقررہ مینٹر',
    scholarshipSupport: 'اسکالرشپ معاونت',
    dailyTasks: 'روزانہ کے کام',
    taskStreak: 'کام کی تسلسل',
    completionVariance: 'مکمل ہونے کے وقت کا فرق',
    miniGames: 'منی گیمز',
    personalizedVideos: 'ذاتی ویڈیوز',
    deviceIntegration: 'ڈیوائس انضمام',
    voiceIntroduction: 'آوازی تعارف'
  },
  gu: {
    languageLabel: 'ભાષા',
    psychologistDirectory: 'મનોવિજ્ઞાનીઓની ડિરેક્ટરી',
    blogLabel: 'બ્લોગ ખોલો',
    addressLabel: 'સરનામું',
    assignedMentor: 'ફાળવેલ માર્ગદર્શક',
    scholarshipSupport: 'સ્કોલરશિપ સહાય',
    dailyTasks: 'દૈનિક કાર્યો',
    taskStreak: 'કાર્ય સ્ટ્રીક',
    completionVariance: 'સમય ભિન્નતા',
    miniGames: 'મિની ગેમ્સ',
    personalizedVideos: 'વ્યક્તિગત વિડિઓ',
    deviceIntegration: 'ડિવાઇસ એકીકરણ',
    voiceIntroduction: 'વોઇસ પરિચય'
  },
  kn: {
    languageLabel: 'ಭಾಷೆ',
    psychologistDirectory: 'ಮನೋವೈದ್ಯರ ಡೈರೆಕ್ಟರಿ',
    blogLabel: 'ಬ್ಲಾಗ್ ತೆರೆಯಿರಿ',
    addressLabel: 'ವಿಳಾಸ',
    assignedMentor: 'ನಿಯೋಜಿತ ಮಾರ್ಗದರ್ಶಕ',
    scholarshipSupport: 'ವಿದ್ಯಾರ್ಥಿವೇತನ ಸಹಾಯ',
    dailyTasks: 'ದೈನಂದಿನ ಕಾರ್ಯಗಳು',
    taskStreak: 'ಕಾರ್ಯ ಸರಣಿ',
    completionVariance: 'ಪೂರ್ಣಗೊಳಿಸುವ ಸಮಯ ವ್ಯತ್ಯಾಸ',
    miniGames: 'ಮಿನಿ ಆಟಗಳು',
    personalizedVideos: 'ವೈಯಕ್ತಿಕ ವಿಡಿಯೋಗಳು',
    deviceIntegration: 'ಸಾಧನ ಏಕೀಕರಣ',
    voiceIntroduction: 'ಧ್ವನಿ ಪರಿಚಯ'
  },
  ml: {
    languageLabel: 'ഭാഷ',
    psychologistDirectory: 'മനശ്ശാസ്ത്ര ഡയറക്ടറി',
    blogLabel: 'ബ്ലോഗ് തുറക്കുക',
    addressLabel: 'വിലാസം',
    assignedMentor: 'നിയോഗിച്ച മെന്റർ',
    scholarshipSupport: 'സ്കോളർഷിപ്പ് പിന്തുണ',
    dailyTasks: 'ദൈനംദിന പ്രവൃത്തികൾ',
    taskStreak: 'ടാസ്ക് സ്ട്രീക്ക്',
    completionVariance: 'സമയം വ്യത്യാസം',
    miniGames: 'മിനി ഗെയിമുകൾ',
    personalizedVideos: 'വ്യക്തിഗത വീഡിയോകൾ',
    deviceIntegration: 'ഡിവൈസ് സംയോജനം',
    voiceIntroduction: 'ശബ്ദ പരിചയം'
  },
  pa: {
    languageLabel: 'ਭਾਸ਼ਾ',
    psychologistDirectory: 'ਮਨੋਵਿਗਿਆਨੀ ਡਾਇਰੈਕਟਰੀ',
    blogLabel: 'ਬਲੌਗ ਖੋਲ੍ਹੋ',
    addressLabel: 'ਪਤਾ',
    assignedMentor: 'ਨਿਯੁਕਤ ਮੈਨਟਰ',
    scholarshipSupport: 'ਸਕਾਲਰਸ਼ਿਪ ਸਹਾਇਤਾ',
    dailyTasks: 'ਰੋਜ਼ਾਨਾ ਕੰਮ',
    taskStreak: 'ਕੰਮ ਲੜੀ',
    completionVariance: 'ਸਮੇਂ ਦੀ ਵੱਖਰਤਾ',
    miniGames: 'ਮਿਨੀ ਗੇਮਾਂ',
    personalizedVideos: 'ਨਿੱਜੀ ਵੀਡੀਓ',
    deviceIntegration: 'ਡਿਵਾਈਸ ਇਕੀਕਰਨ',
    voiceIntroduction: 'ਆਵਾਜ਼ ਪਛਾਣ'
  },
  or: {
    languageLabel: 'ଭାଷା',
    psychologistDirectory: 'ମନୋବିଜ୍ଞାନୀ ତାଲିକା',
    blogLabel: 'ବ୍ଲଗ୍ ଖୋଲନ୍ତୁ',
    addressLabel: 'ଠିକଣା',
    assignedMentor: 'ନିଯୁକ୍ତ ମେଣ୍ଟର',
    scholarshipSupport: 'ଛାତ୍ରବୃତ୍ତି ସହାୟତା',
    dailyTasks: 'ଦୈନିକ କାମ',
    taskStreak: 'କାମ ଷ୍ଟ୍ରିକ୍',
    completionVariance: 'ସମୟ ପରିବର୍ତ୍ତନ',
    miniGames: 'ମିନି ଖେଳ',
    personalizedVideos: 'ବ୍ୟକ୍ତିଗତ ଭିଡିଓ',
    deviceIntegration: 'ଡିଭାଇସ ଇଣ୍ଟିଗ୍ରେସନ୍',
    voiceIntroduction: 'ଶବ୍ଦ ପରିଚୟ'
  }
};

async function translateText(text, language) {
  if (!env.translationApiUrl || !text || language === 'en') {
    return text;
  }

  try {
    const response = await axios.post(
      env.translationApiUrl,
      {
        q: text,
        source: 'en',
        target: language
      },
      {
        timeout: 3000
      }
    );

    return response.data?.translatedText || text;
  } catch (_error) {
    return text;
  }
}

async function getSupportCopy(language = 'en') {
  const fallback = FALLBACK_COPY[language] || FALLBACK_COPY.en;

  if (!env.translationApiUrl || FALLBACK_COPY[language]) {
    return fallback;
  }

  const keys = Object.keys(FALLBACK_COPY.en);
  const translatedValues = await Promise.all(
    keys.map((key) => translateText(FALLBACK_COPY.en[key], language))
  );

  return keys.reduce((result, key, index) => {
    result[key] = translatedValues[index];
    return result;
  }, {});
}

module.exports = {
  getSupportCopy,
  FALLBACK_COPY
};
