export function summarizeFaces(results) {
  if (!results.length) return null;
  const summary = { totalPeople: results.length, maleCount: 0, femaleCount: 0, childCount: 0, unknownCount: 0 };
  for (const face of results) {
    if (Number.isFinite(face.age) && face.age < 15) summary.childCount++;
    else if (face.genderProbability >= 0.8 && face.gender === 'male') summary.maleCount++;
    else if (face.genderProbability >= 0.8 && face.gender === 'female') summary.femaleCount++;
    else summary.unknownCount++;
  }
  return summary;
}

export function buildSubjectDirective(summary) {
  const keys = ['maleCount', 'femaleCount', 'childCount', 'unknownCount'];
  if (!summary || !Number.isInteger(summary.totalPeople) || summary.totalPeople < 1 || summary.totalPeople > 50 ||
      keys.some(key => !Number.isInteger(summary[key]) || summary[key] < 0) ||
      keys.reduce((sum, key) => sum + summary[key], 0) !== summary.totalPeople) {
    return 'Local face analysis is unavailable or inconclusive. Determine the people count from the reference photo and preserve EVERY visible participant; do not assume a single person or assign gender labels.';
  }
  const groups = [
    [summary.maleCount, 'adult man', 'adult men'], [summary.femaleCount, 'adult woman', 'adult women'],
    [summary.childCount, 'child', 'children'], [summary.unknownCount, 'person of uncertain gender', 'people of uncertain gender'],
  ].filter(([count]) => count > 0).map(([count, singular, plural]) => `${count} ${count === 1 ? singular : plural}`);
  return `Local face analysis estimates ${summary.totalPeople} ${summary.totalPeople === 1 ? 'person' : 'people'}: ${groups.join(', ')}. Use this people count and gender estimate to plan individual era-appropriate outfits. For estimated men, use the era's tailored jackets, shirts and trousers; for estimated women, use modest blouses, long dresses or coordinated full-length ensembles; for children, use age-appropriate versions of the era attire. Preserve each person's clothing presentation and preferences in the reference. These are uncertain visual estimates: the photo is authoritative if a face was missed or a classification is incorrect. Never omit, add or duplicate participants to match an estimate, change apparent age or gender presentation, or infer a headcover from gender. Preserve any visible religious or cultural headcover for every participant, including women; never add one when absent.`;
}
