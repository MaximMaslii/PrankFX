/**
 * Curated collections used on Home → Discover. Each collection points to a
 * list of effect IDs already defined in the backend catalog. The daily
 * featured effect rotates deterministically based on the current date, so
 * every device sees the same daily pick without needing a server call.
 */
export type Collection = {
  id: string;
  title: string;
  subtitle: string;
  hero: string;
  effectIds: string[];
  accent: [string, string];
};

export const COLLECTIONS: Collection[] = [
  {
    id: "hollywood_villains",
    title: "Hollywood Villains",
    subtitle: "Zombies, pirates, vampires & monsters",
    hero: "https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=800&q=75",
    effectIds: ["zombie", "pirate_scar", "vampire_bite", "monster_attack", "alien_attack", "robot_damage"],
    accent: ["#2E1A47", "#7B1E7A"],
  },
  {
    id: "action_movie_night",
    title: "Action Movie Night",
    subtitle: "Bruises, explosions & battle scars",
    hero: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=75",
    effectIds: ["movie_bruises", "black_eye", "bandages", "action_hero", "fire_burn", "hollywood_fx"],
    accent: ["#8A0000", "#FF3B30"],
  },
  {
    id: "post_apocalypse",
    title: "Post Apocalypse",
    subtitle: "Ruined cars, houses & wasteland vibes",
    hero: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&q=75",
    effectIds: ["apocalypse_car", "abandoned_car", "post_apocalypse", "abandoned_building", "haunted_house", "movie_explosion"],
    accent: ["#3A1E00", "#B65A00"],
  },
  {
    id: "comedy_night",
    title: "Comedy Night",
    subtitle: "Cake fights, paintball & pranks",
    hero: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=800&q=75",
    effectIds: ["cake_smash", "food_fight", "paintball", "funny_makeup", "comic_fight", "comic_crash"],
    accent: ["#0057B7", "#FFB800"],
  },
  {
    id: "weather_chaos",
    title: "Weather Chaos",
    subtitle: "Snow, floods, fire & ice",
    hero: "https://images.unsplash.com/photo-1523294587484-bae6cc870010?w=800&q=75",
    effectIds: ["fire_burn", "ice_damage", "house_fire", "house_flood", "snow_house", "flood_car"],
    accent: ["#0E3B5E", "#5FB0E5"],
  },
];

/**
 * Rotates through the whole face-effect catalog deterministically based on the
 * current calendar day, so the "Effect of the Day" is stable within a day but
 * changes at local midnight.
 */
const DAILY_POOL = [
  "hollywood_fx",
  "zombie",
  "vampire_bite",
  "monster_attack",
  "action_hero",
  "movie_bruises",
  "fire_burn",
  "paintball",
  "cake_smash",
  "magic_explosion",
  "pirate_scar",
  "alien_attack",
  "robot_damage",
  "comic_fight",
];

export function getDailyEffectId(): string {
  const now = new Date();
  const dayIndex = Math.floor(now.getTime() / (1000 * 60 * 60 * 24));
  return DAILY_POOL[dayIndex % DAILY_POOL.length];
}

export function getCollectionById(id: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.id === id);
}
