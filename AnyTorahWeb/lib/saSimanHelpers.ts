// Lookup helpers over the ported SASimanNames data — siman titles and topic-section groupings
// for the Shulchan Arukh siman picker, matching native's SASimanNames.swift/.kt.
import {
  sectionsOH, sectionsYD, sectionsEH, sectionsHM,
  simanNamesEnOH, simanNamesEnYD, simanNamesEnEH, simanNamesEnHM,
  simanNamesOH, simanNamesYD, simanNamesEH, simanNamesHM,
  hebNamesOH, hebNamesYD, hebNamesEH, hebNamesHM,
  type SATopicSection,
} from "./saSimanNames";

const SECTIONS: SATopicSection[][] = [sectionsOH, sectionsYD, sectionsEH, sectionsHM];
const SIMAN_NAMES_EN: string[][] = [simanNamesEnOH, simanNamesEnYD, simanNamesEnEH, simanNamesEnHM];
const SIMAN_NAMES_HE: string[][] = [simanNamesOH, simanNamesYD, simanNamesEH, simanNamesHM];
const HEB_SECTION_NAMES: string[][] = [hebNamesOH, hebNamesYD, hebNamesEH, hebNamesHM];

/** Topic-section list for the given SA section (0=OC, 1=YD, 2=EH, 3=HM). `name` is swapped to
 *  the parallel Hebrew topic name (saHebrewNames.ts) when hebrewMode is on. */
export function getSATopicSections(section: number, hebrewMode = false): SATopicSection[] {
  const sections = SECTIONS[section] ?? [];
  if (!hebrewMode) return sections;
  const hebNames = HEB_SECTION_NAMES[section] ?? [];
  return sections.map((s, i) => ({ ...s, name: hebNames[i] ?? s.name }));
}

/** Siman title (English or Hebrew), or null if this siman has no distinct title on Sefaria. */
export function getSASimanTitle(section: number, siman: number, hebrewMode = false): string | null {
  const names = (hebrewMode ? SIMAN_NAMES_HE : SIMAN_NAMES_EN)[section];
  if (!names || siman < 1 || siman > names.length) return null;
  const name = names[siman - 1];
  return name ? name : null;
}
