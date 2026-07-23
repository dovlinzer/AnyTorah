// Lookup helpers over the ported SASimanNames data — siman titles and topic-section groupings
// for the Shulchan Arukh siman picker, matching native's SASimanNames.swift/.kt.
import {
  sectionsOH, sectionsYD, sectionsEH, sectionsHM,
  simanNamesEnOH, simanNamesEnYD, simanNamesEnEH, simanNamesEnHM,
  type SATopicSection,
} from "./saSimanNames";

const SECTIONS: SATopicSection[][] = [sectionsOH, sectionsYD, sectionsEH, sectionsHM];
const SIMAN_NAMES_EN: string[][] = [simanNamesEnOH, simanNamesEnYD, simanNamesEnEH, simanNamesEnHM];

/** English topic-section list for the given SA section (0=OC, 1=YD, 2=EH, 3=HM). */
export function getSATopicSections(section: number): SATopicSection[] {
  return SECTIONS[section] ?? [];
}

/** English siman title, or null if this siman has no distinct title on Sefaria. */
export function getSASimanTitle(section: number, siman: number): string | null {
  const names = SIMAN_NAMES_EN[section];
  if (!names || siman < 1 || siman > names.length) return null;
  const name = names[siman - 1];
  return name ? name : null;
}
