// Lore + tuning data for the twelve creatures of Blackbriar.
// Original writing, loosely grounded in the folklore and reported sightings.

export const CREATURES = [
  {
    id: 'wendigo',
    name: 'Wendigo',
    epithet: 'The Hunger That Walks',
    origin: 'Algonquian folklore · Great Lakes & Canadian north · oral tradition, centuries old',
    description:
      'A winter spirit of famine, said to be born when a person gives in to the hunger of the deep cold and eats of their own kind. Elders describe a gaunt, ash-grey thing taller than the pines, lips ragged, its breath a rime of frost. The more it eats, the more starved it becomes.',
    behavior:
      'Follows your scent trail at a patient walk and never tires. Once it sees you it runs faster than you can. From far off it calls in a human voice.',
    survival:
      'Do not trust voices in the trees, and never let it see where you hide.',
    threat: 5,
    accent: '#8fa7b8',
  },
  {
    id: 'skinwalker',
    name: 'Skinwalker',
    epithet: 'The One Who Wears Faces',
    origin: 'Diné (Navajo) tradition · American Southwest · told with great caution',
    description:
      'Among the Diné, a person who has turned to witchcraft is said to take the shape of an animal, or the voice of someone you love. Travellers on lonely roads report a figure keeping pace just past the headlights, and a voice at the window using a dead relative\'s words. It is never in a hurry.',
    behavior:
      'Circles you at the edge of your light, 18 to 30 metres out. It creeps closer only while unobserved, backs off when lit, and charges when you are near or have turned your back too long.',
    survival:
      'Keep it in the beam and keep facing it. Never turn your back for long.',
    threat: 4,
    accent: '#a0663f',
  },
  {
    id: 'dogman',
    name: 'Dogman',
    epithet: 'Beast of the Long Road',
    origin: 'American Midwest · Michigan and Wisconsin sightings · 1930s to the present',
    description:
      'Witnesses describe a man-sized creature with a wolf\'s skull and shoulders, walking upright one moment and loping on all fours the next. Reports cluster along back roads and tree lines, always with the same detail: the eyes, which seem to understand. Michigan radio listeners have been trading these stories since the late eighties.',
    behavior:
      'Patrols widely and hears sprinting from very far away, then runs you down faster than you can flee. It loses the trail easily when sight is broken and is easy to lure with thrown rocks.',
    survival:
      'Walk, do not sprint. Break line of sight, hide, and throw a rock to send it elsewhere.',
    threat: 4,
    accent: '#7a6a58',
  },
  {
    id: 'rake',
    name: 'The Rake',
    epithet: 'What Crawls Behind',
    origin: 'Internet folklore · English-language forums · 2000s, with older "crawler" tales behind it',
    description:
      'Accounts describe a pale, hairless, dog-sized thing that moves on elbows and knees and stares too long. Those who survive a night with it say it never attacks head-on. It waits in whatever part of the dark you are not looking at, and it returns the following night.',
    behavior:
      'Crawls low and approaches from behind. It strikes when your flashlight is off or pointed away. Light drives it off screeching, but it comes back from a new angle.',
    survival:
      'Keep your light on and sweep behind you. Light it and it will flee.',
    threat: 4,
    accent: '#b8b0a0',
  },
  {
    id: 'mothman',
    name: 'Mothman',
    epithet: 'Harbinger Over the Bridge',
    origin: 'Point Pleasant, West Virginia · 1966 to 1967',
    description:
      'In November 1966, witnesses near an old munitions site reported a winged figure taller than a man, with no head to speak of and two eyes like red reflectors. Others described it pacing their cars on the highway. Thirteen months later the Silver Bridge fell into the Ohio River, and the sightings have been read as a warning ever since.',
    behavior:
      'Circles high overhead, drawn to your light. If the beam stays on in the open it dives. Thick canopy and darkness shake it off.',
    survival:
      'Stay under the trees and put the light out when something circles above.',
    threat: 3,
    accent: '#a83a3a',
  },
  {
    id: 'jerseydevil',
    name: 'Jersey Devil',
    epithet: 'The Thirteenth Child',
    origin: 'Pine Barrens, New Jersey · colonial era onward · major panic of January 1909',
    description:
      'The legend says a woman cursed her thirteenth child in labour, and it flew up the chimney as something with hooves, a horse\'s head, and leathery wings. In one week of January 1909 hundreds of people reported tracks across snow, crossing rooftops and fences alike. Schools closed, and the tracks led nowhere.',
    behavior:
      'Screeches to announce a charge, then runs a straight line at terrible speed without turning. A tree in its path stuns it.',
    survival:
      'Listen for the screech, sidestep at the last moment, and keep a trunk between you.',
    threat: 4,
    accent: '#8c3d2e',
  },
  {
    id: 'notdeer',
    name: 'Not-Deer',
    epithet: 'Wrong in the Headlights',
    origin: 'Appalachian and Midwestern campfire lore · social media era, 2010s onward',
    description:
      'It stands in the road like a deer, but the joints bend the wrong way and the face is almost, but not quite, a face. Campers describe animals that do not flinch, do not blink, and walk on legs a little too long. The old warning is simple: if you are not sure what it is, it is not a deer.',
    behavior:
      'Holds perfectly still while you watch it. The moment your eyes leave it, it moves, and very fast.',
    survival:
      'Never look away. Back off with your light on it.',
    threat: 5,
    accent: '#c2b9a3',
  },
  {
    id: 'leshy',
    name: 'Leshy',
    epithet: 'The Tree That Walks',
    origin: 'Slavic folklore · Russian and Belarusian forests · medieval to 19th century',
    description:
      'The forest\'s own master, a shape-shifter who may stand as tall as the trees or shrink to the height of a blade of grass. Peasants left bread at the forest edge for him, and those who forgot were led in circles until dark. His eyes burn green, and he casts no shadow.',
    behavior:
      'Stands motionless among the trees, disguised as one. When unobserved it relocates closer, and it grabs anyone within about 3 metres. A beam within 14 metres shows its eyes and makes it shift away.',
    survival:
      'Sweep your light across the tree line. A tree with eyes is not a tree.',
    threat: 3,
    accent: '#5e8a4a',
  },
  {
    id: 'nightcrawler',
    name: 'Fresno Nightcrawler',
    epithet: 'Walking Trousers',
    origin: 'Fresno, California · security-camera footage, 1990s and 2000s',
    description:
      'Grainy footage from a lawn in 2007 shows two pale, legs-only shapes walking in a stiff stride across the grass, with no torso, no head, and nothing above the hip. The gait is unhurried and almost mechanical. Later clips from other cameras show the same stride.',
    behavior:
      'Blind. It hunts purely by sound, with huge hearing, and wanders in a stiff paired gait. It is drawn completely to thrown rocks.',
    survival:
      'Crouch-walk past it, and throw a rock to lead it away.',
    threat: 2,
    accent: '#9aa5ad',
  },
  {
    id: 'banshee',
    name: 'Banshee',
    epithet: 'She Who Wails',
    origin: 'Irish and Scottish Gaelic folklore · bean sídhe, "woman of the fairy mound" · medieval onward',
    description:
      'Her cry was said to foretell a death in certain old families, heard at night beneath the window of the one who would die. Some describe a pale woman combing long hair by a stream, red-eyed from weeping. Others never see her at all and hear only the keening, which carries for miles.',
    behavior:
      'Drifts through the woods. When she sees you she winds up for two seconds, then screams, which can be heard across the whole forest and wakes every creature. Staying within 6 metres of her wail for 3 seconds kills.',
    survival:
      'Break line of sight before the scream ends, and get away from the wail.',
    threat: 3,
    accent: '#7da3c4',
  },
  {
    id: 'flatwoods',
    name: 'Flatwoods Monster',
    epithet: 'The Thing in the Mist',
    origin: 'Flatwoods, West Virginia · September 1952',
    description:
      'Boys went up a hill to see where a light had fallen and found a hovering figure ten feet tall, with a spade-shaped head, glowing eyes, and a body like a dark hood. A sickening mist hung around it, and witnesses fell ill afterwards, with burning throats and headaches. The grass at the site was flattened.',
    behavior:
      'Hovers slowly straight at you and ignores rocks. Within 22 metres it drains your battery and makes the light flicker. Staying within 4 metres of its gas for 2.5 seconds kills.',
    survival:
      'Back off or put distance between you before the battery dies. Rocks will not help.',
    threat: 3,
    accent: '#8ea64a',
  },
  {
    id: 'llorona',
    name: 'La Llorona',
    epithet: 'The Weeping Woman',
    origin: 'Mexican and Mexican-American folklore · Spanish colonial era onward',
    description:
      'A woman in white drowned her own children and now walks every river, calling for them. Parents told the story to keep children away from the water at night. Her weeping is the warning: if it is faint, she is close, and the child who listens is the child she takes.',
    behavior:
      'Haunts the water. Her weeping is loud when she is far and quiet when she is near. Shine your light on her for more than a second and she rushes you at terrifying speed.',
    survival:
      'Do not look at her. Keep away from the water, and fear the silence.',
    threat: 5,
    accent: '#5f8fa3',
  },
];

export const CREATURE_BY_ID = Object.fromEntries(CREATURES.map((c) => [c.id, c]));
