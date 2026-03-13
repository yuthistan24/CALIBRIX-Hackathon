const mediaCatalog = require('../data/mediaCatalog');
const miniGames = require('../data/miniGames');

function languageToCode(language = '') {
  const normalized = String(language || '').toLowerCase();
  if (normalized.startsWith('tamil') || normalized.includes(' தமிழ்') || normalized === 'ta') {
    return 'ta';
  }
  return 'en';
}

function clampList(items = [], limit = 3) {
  return Array.isArray(items) ? items.slice(0, Math.max(0, limit)) : [];
}

function pickByKind(kind, languageCode) {
  const preferred = mediaCatalog.filter((item) => item.kind === kind && item.language === languageCode);
  if (preferred.length) {
    return preferred;
  }
  return mediaCatalog.filter((item) => item.kind === kind && item.language === 'en');
}

function recommendGame(topicKey = 'emotional') {
  if (topicKey === 'academic') {
    return miniGames.find((game) => game.id === 'number-puzzle') || miniGames[0];
  }
  if (topicKey === 'social' || topicKey === 'family') {
    return miniGames.find((game) => game.id === 'word-search') || miniGames[0];
  }
  if (topicKey === 'sleep' || topicKey === 'anxiety') {
    return miniGames.find((game) => game.id === 'memory-card') || miniGames[0];
  }
  return miniGames[0];
}

function recommendMedia({ topicKey = 'emotional', sentimentLabel = 'Neutral', language = 'English' } = {}) {
  const languageCode = languageToCode(language);

  const wantsFocus = topicKey === 'academic' || topicKey === 'sleep';
  const highStress = String(sentimentLabel || '').toLowerCase() === 'negative';

  const ambient = pickByKind('ambient', languageCode);
  const music = pickByKind('music', languageCode);
  const comedy = pickByKind('comedy', languageCode);

  return {
    game: recommendGame(topicKey),
    ambient: clampList(ambient, wantsFocus || highStress ? 1 : 1),
    music: clampList(music, wantsFocus ? 1 : 1),
    comedy: clampList(comedy, topicKey === 'social' ? 1 : 1),
    languageCode
  };
}

module.exports = {
  recommendMedia
};

