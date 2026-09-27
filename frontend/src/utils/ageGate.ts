/**
 * Whether the person has seen the content notice, and what they answered.
 *
 * Two booleans rather than one tri-state value, because the storage helper
 * only round-trips primitives — and "asked but said no" has to be told apart
 * from "never asked", otherwise the notice would reappear on every launch for
 * anyone under 18.
 */
import { storage } from "@/src/utils/storage";

const ASKED_KEY = "prankfx.age.asked.v1";
const ADULT_KEY = "prankfx.age.adult.v1";

export type AgeAnswer = {
  asked: boolean;
  adult: boolean;
};

export async function getAgeAnswer(): Promise<AgeAnswer> {
  const [asked, adult] = await Promise.all([
    storage.getItem<boolean>(ASKED_KEY, false),
    storage.getItem<boolean>(ADULT_KEY, false),
  ]);

  return { asked: !!asked, adult: !!adult };
}

export async function setAgeAnswer(adult: boolean): Promise<void> {
  await storage.setItem(ADULT_KEY, adult);
  await storage.setItem(ASKED_KEY, true);
}

/**
 * Used by the effect pickers to hide the effects marked age-restricted.
 * A "no" answer is taken at face value — this is a courtesy filter, not an
 * identity check, and nothing pretends otherwise.
 */
export async function isAdultConfirmed(): Promise<boolean> {
  const { asked, adult } = await getAgeAnswer();

  // Never asked yet → do not hide anything; the notice is about to appear.
  return asked ? adult : true;
}
