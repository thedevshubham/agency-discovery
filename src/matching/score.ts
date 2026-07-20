import { extractSkills } from "./skills.js";

const TITLE_STOP_WORDS = new Set([
  "and",
  "the",
  "of",
  "for",
  "to",
  "a",
  "an",
  "senior",
  "junior",
  "lead",
  "specialist",
  "developer",
  "development",
  "engineer",
  "executive",
  "manager",
]);

export type MatchScore = {
  score: number;
  titleScore: number;
  skillScore: number;
  matchedTerms: string[];
  missingTerms: string[];
};

function titleTerms(title: string): string[] {
  return [
    ...new Set(
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .filter((term) => term.length > 1 && !TITLE_STOP_WORDS.has(term)),
    ),
  ];
}

export function scoreJobForResume(
  resumeText: string,
  job: { title: string; description?: string | null },
): MatchScore {
  const resumeSearchable = ` ${resumeText
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")} `;
  const terms = titleTerms(job.title);
  const matchedTitleTerms = terms.filter((term) =>
    resumeSearchable.includes(` ${term} `),
  );
  const missingTitleTerms = terms.filter(
    (term) => !matchedTitleTerms.includes(term),
  );
  const titleScore = terms.length
    ? Math.round((matchedTitleTerms.length / terms.length) * 60)
    : 0;

  const resumeSkills = new Set(extractSkills(resumeText));
  const jobSkills = extractSkills(`${job.title}\n${job.description ?? ""}`);
  const matchedSkills = jobSkills.filter((skill) => resumeSkills.has(skill));
  const missingSkills = jobSkills.filter((skill) => !resumeSkills.has(skill));
  const skillScore = jobSkills.length
    ? Math.round((matchedSkills.length / jobSkills.length) * 40)
    : 0;
  const score = jobSkills.length
    ? titleScore + skillScore
    : terms.length
      ? Math.round((matchedTitleTerms.length / terms.length) * 70)
      : 0;

  return {
    score,
    titleScore,
    skillScore,
    matchedTerms: [...new Set([...matchedTitleTerms, ...matchedSkills])],
    missingTerms: [...new Set([...missingTitleTerms, ...missingSkills])],
  };
}
