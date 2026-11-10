export interface Topic { id: string; name: string; aliases: string[]; text: string; viva: string[]; refs: string[] }
export const TOPICS: Topic[] = [
  {
    id: 'cubital_fossa', name: 'Cubital fossa', aliases: ['cubital fossa', 'elbow fossa'],
    text: 'The cubital fossa is the triangular depression on the anterior elbow. Base (superior): an imaginary line between the medial and lateral epicondyles. Lateral border: brachioradialis. Medial border: pronator teres. Floor: brachialis and supinator. Roof: skin, superficial fascia (with the median cubital vein and cutaneous nerves), deep fascia and the bicipital aponeurosis. Contents, lateral to medial: biceps tendon, brachial artery (dividing into radial and ulnar), median nerve; the radial nerve lies laterally between brachialis and brachioradialis.',
    viva: ['State the boundaries of the cubital fossa.', 'List the contents of the cubital fossa from lateral to medial.', 'What forms the floor and the roof?', 'Which vein is used for venepuncture and why is it relatively safe?', 'What protects the brachial artery and median nerve from the superficial veins?', 'At what level does the brachial artery divide?'],
    refs: ['Moore: Clinically Oriented Anatomy — Cubital fossa (verify page)', "Gray's Anatomy — Elbow region (verify page)"],
  },
  {
    id: 'bicipital_groove', name: 'Medial bicipital groove', aliases: ['medial bicipital groove', 'bicipital groove medial', 'medial bicipital'],
    text: 'The medial bicipital groove lies along the medial border of biceps brachii. It transmits the brachial artery, the median nerve (crossing the artery), the basilic vein (deep part), the ulnar nerve (proximally) and the medial cutaneous nerves of the arm and forearm.',
    viva: ['What structures run in the medial bicipital groove?', 'How does the median nerve cross the brachial artery?'], refs: ['Moore: Clinically Oriented Anatomy — Arm (verify page)'],
  },
];
