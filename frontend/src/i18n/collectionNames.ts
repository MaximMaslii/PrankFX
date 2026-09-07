export const collectionNames = {
  en: {
    hollywood_villains: {
      title: "Hollywood Villains",
      subtitle: "Zombies, pirates, vampires & monsters",
    },
    action_movie_night: {
      title: "Action Movie Night",
      subtitle: "Bruises, explosions & battle scars",
    },
    post_apocalypse: {
      title: "Post Apocalypse",
      subtitle: "Ruined cars, houses & wasteland vibes",
    },
    comedy_night: {
      title: "Comedy Night",
      subtitle: "Cake fights, paintball & pranks",
    },
    weather_chaos: {
      title: "Weather Chaos",
      subtitle: "Snow, floods, fire & ice",
    },
  },

  ru: {
    hollywood_villains: {
      title: "Голливудские злодеи",
      subtitle: "Зомби, пираты, вампиры и монстры",
    },
    action_movie_night: {
      title: "Вечер боевиков",
      subtitle: "Синяки, взрывы и боевые шрамы",
    },
    post_apocalypse: {
      title: "Постапокалипсис",
      subtitle: "Разбитые машины, разрушенные дома и пустоши",
    },
    comedy_night: {
      title: "Вечер комедии",
      subtitle: "Битвы тортами, пейнтбол и розыгрыши",
    },
    weather_chaos: {
      title: "Погодный хаос",
      subtitle: "Снег, наводнения, огонь и лёд",
    },
  },

  de: {
    hollywood_villains: {
      title: "Hollywood-Bösewichte",
      subtitle: "Zombies, Piraten, Vampire und Monster",
    },
    action_movie_night: {
      title: "Actionfilm-Abend",
      subtitle: "Blutergüsse, Explosionen und Kampfnarben",
    },
    post_apocalypse: {
      title: "Postapokalypse",
      subtitle: "Zerstörte Autos, Häuser und Ödland",
    },
    comedy_night: {
      title: "Comedy-Abend",
      subtitle: "Tortenschlachten, Paintball und Streiche",
    },
    weather_chaos: {
      title: "Wetterchaos",
      subtitle: "Schnee, Überschwemmungen, Feuer und Eis",
    },
  },
} as const;

export type CollectionNameKey = keyof typeof collectionNames.en;

export function getCollectionName(
  id: string,
  lang: keyof typeof collectionNames,
  fallbackTitle: string,
) {
  return collectionNames[lang][id as CollectionNameKey]?.title ?? fallbackTitle;
}

export function getCollectionSubtitle(
  id: string,
  lang: keyof typeof collectionNames,
  fallbackSubtitle: string,
) {
  return collectionNames[lang][id as CollectionNameKey]?.subtitle ?? fallbackSubtitle;
}