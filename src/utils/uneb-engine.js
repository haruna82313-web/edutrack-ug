// UNEB Dual-Track Calculation Engine
// For Uganda National Examinations Board (UNEB) standards

/**
 * Calculate weighted paper score from multiple papers
 * @param {Array} paperScores - Array of { received_raw_mark, max_possible_raw_mark, paper_weight_percentage }
 * @returns {number} Final score out of 100
 */
export const calculateWeightedPaperScore = (paperScores) => {
  if (!paperScores || paperScores.length === 0) return 0;

  let totalWeightedScore = 0;
  let totalWeight = 0;

  paperScores.forEach(paper => {
    const ratio = paper.received_raw_mark / paper.max_possible_raw_mark;
    const contribution = ratio * paper.paper_weight_percentage;
    totalWeightedScore += contribution;
    totalWeight += paper.paper_weight_percentage;
  });

  // Normalize to 100 if weights don't sum perfectly (for safety)
  return totalWeight > 0 ? (totalWeightedScore / totalWeight) * 100 : 0;
};

/**
 * Calculate O-Level total score from CA and Summative
 * @param {Array} aoiScores - Array of AoI scores (1-3)
 * @param {number} summativeScore - Summative exam score out of 100
 * @returns {number} Final total score out of 100
 */
export const calculateOLevelTotal = (aoiScores, summativeScore) => {
  // Calculate CA score (20% of total)
  const averageAoi = aoiScores.reduce((sum, score) => sum + score, 0) / aoiScores.length;
  const caScore = (averageAoi / 3) * 20;

  // Calculate Summative score (80% of total)
  const summativeContribution = (summativeScore / 100) * 80;

  return caScore + summativeContribution;
};

/**
 * Get O-Level grade and descriptor from score
 * @param {number} score - Score out of 100
 * @returns {Object} { grade: string, descriptor: string }
 */
export const getOLevelGrade = (score) => {
  if (score >= 80) return { grade: 'A', descriptor: 'Exceptional' };
  if (score >= 70) return { grade: 'B', descriptor: 'Outstanding' };
  if (score >= 50) return { grade: 'C', descriptor: 'Satisfactory' };
  if (score >= 40) return { grade: 'D', descriptor: 'Basic' };
  return { grade: 'E', descriptor: 'Elementary' };
};

/**
 * Get A-Level Principal subject grade and points
 * @param {number} score - Score out of 100
 * @returns {Object} { grade: string, points: number, descriptor: string }
 */
export const getALevelPrincipalGradeAndPoints = (score) => {
  if (score >= 80) return { grade: 'A', points: 6, descriptor: 'Exceptional Understanding' };
  if (score >= 70) return { grade: 'B', points: 5, descriptor: 'Outstanding Performance' };
  if (score >= 60) return { grade: 'C', points: 4, descriptor: 'Satisfactory Performance' };
  if (score >= 50) return { grade: 'D', points: 3, descriptor: 'Basic Understanding' };
  if (score >= 40) return { grade: 'E', points: 2, descriptor: 'Elementary Understanding' };
  if (score >= 35) return { grade: 'O', points: 1, descriptor: 'Subsidiary Pass Level' };
  return { grade: 'F', points: 0, descriptor: 'Fail' };
};

/**
 * Get A-Level Subsidiary grade and points (GP, Sub-Maths, ICT)
 * @param {number} score - Score out of 100
 * @returns {Object} { grade: string, points: number }
 */
export const getALevelSubsidiaryGradeAndPoints = (score) => {
  if (score >= 50) return { grade: 'Pass (O)', points: 1 };
  return { grade: 'Fail (F)', points: 0 };
};

/**
 * Calculate total A-Level points from 3 Principals + GP + Subsidiary
 * @param {Array} principalScores - Array of 3 principal subject scores out of 100
 * @param {number} gpScore - GP score out of 100
 * @param {number} subsidiaryScore - Subsidiary subject score out of 100
 * @returns {number} Total points (max 20)
 */
export const calculateTotalALevelPoints = (principalScores, gpScore, subsidiaryScore) => {
  const principalPoints = principalScores.reduce((sum, score) => {
    return sum + getALevelPrincipalGradeAndPoints(score).points;
  }, 0);

  const gpPoints = getALevelSubsidiaryGradeAndPoints(gpScore).points;
  const subsidiaryPoints = getALevelSubsidiaryGradeAndPoints(subsidiaryScore).points;

  return principalPoints + gpPoints + subsidiaryPoints;
};

/**
 * Determine required subsidiary subject based on combination
 * @param {string} combination - Student's subject combination (e.g., 'PCM', 'HEG')
 * @returns {string} 'ICT' or 'Mathematics'
 */
export const determineRequiredSubsidiary = (combination) => {
  const scienceCombinations = ['PCM', 'BCM', 'PCB', 'PEM', 'PCZ', 'MCB'];
  return scienceCombinations.includes(combination?.toUpperCase()) ? 'ICT' : 'Mathematics';
};

/**
 * Determine O-Level Result Status
 * @param {Array} marks - Array of { score } for all subjects
 * @returns {string} 'Result 1', 'Result 2', or 'Result 3'
 */
export const determineOLevelResultStatus = (marks) => {
  // Check if any subject has at least a D (>=40)
  const hasAtLeastD = marks.some(m => m.score >= 40);
  
  // Check if all are E (<40)
  const allE = marks.every(m => m.score < 40);

  if (hasAtLeastD) return 'Result 1';
  if (allE) return 'Result 3';
  return 'Result 2';
};
