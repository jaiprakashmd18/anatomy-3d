// Right upper-limb build configuration: maps application structure IDs -> BodyParts3D (FMA) meshes.
// Source: BodyParts3D 3.0 (Life Science Integrated Database Center), CC BY-SA 2.1 JP.
export const SOURCE = {
  name: 'BodyParts3D',
  version: '3.0 (20110915), STL mirror by K. M. Moerman at commit f0eeb6e',
  license: 'CC BY-SA 2.1 Japan',
  attribution: 'BodyParts3D, © The Database Center for Life Science, licensed under CC Attribution-Share Alike 2.1 Japan',
  citation: 'Mitsuhashi N, et al. BodyParts3D: 3D structure database for anatomical concepts. Nucleic Acids Res. 2009;37:D782-5. doi:10.1093/nar/gkn613',
};

// id, name (English/TA), fma meshes, layer, target triangle budget per mesh
export const MESH_STRUCTURES = [
  // Bones
  ['clavicle', 'Clavicle', [13322], 'bone', 9000],
  ['scapula', 'Scapula', [13395], 'bone', 14000],
  ['humerus', 'Humerus', [23130], 'bone', 14000],
  ['radius', 'Radius', [23464], 'bone', 9000],
  ['ulna', 'Ulna', [23467], 'bone', 9000],
  ['scaphoid', 'Scaphoid', [24435], 'bone', 1500], ['lunate', 'Lunate', [24437], 'bone', 1500],
  ['triquetrum', 'Triquetrum', [24439], 'bone', 1500], ['pisiform', 'Pisiform', [24441], 'bone', 1200],
  ['trapezium', 'Trapezium', [24443], 'bone', 1500], ['trapezoid', 'Trapezoid', [23725], 'bone', 1500],
  ['capitate', 'Capitate', [24446], 'bone', 1500], ['hamate', 'Hamate', [24448], 'bone', 1500],
  ['metacarpal_1', 'First metacarpal', [24464], 'bone', 1800], ['metacarpal_2', 'Second metacarpal', [24466], 'bone', 1800],
  ['metacarpal_3', 'Third metacarpal', [24468], 'bone', 1800], ['metacarpal_4', 'Fourth metacarpal', [24470], 'bone', 1800],
  ['metacarpal_5', 'Fifth metacarpal', [24472], 'bone', 1800],
  // Shoulder girdle muscles (context)
  ['pectoralis_major', 'Pectoralis major', [34690, 45874, 79979], 'muscle', 5000],
  ['pectoralis_minor', 'Pectoralis minor', [13375], 'muscle', 4000],
  ['deltoid', 'Deltoid', [34680, 34682, 34684], 'muscle', 5000],
  ['teres_major', 'Teres major', [32551], 'muscle', 4000],
  ['teres_minor', 'Teres minor', [32553], 'muscle', 3000],
  ['subscapularis', 'Subscapularis', [13414], 'muscle', 5000],
  ['supraspinatus', 'Supraspinatus', [32544], 'muscle', 4000],
  ['infraspinatus', 'Infraspinatus', [32547], 'muscle', 5000],
  // Arm
  ['biceps_brachii', 'Biceps brachii', [37686, 37684], 'muscle', 7000],
  ['brachialis', 'Brachialis', [37668], 'muscle', 6000],
  ['coracobrachialis', 'Coracobrachialis', [37665], 'muscle', 3500],
  ['triceps_brachii', 'Triceps brachii', [37699, 37697, 37695], 'muscle', 8000],
  ['anconeus', 'Anconeus', [37705], 'muscle', 2000],
  // Forearm
  ['brachioradialis', 'Brachioradialis', [38486], 'muscle', 5000],
  ['pronator_teres', 'Pronator teres', [38560, 38562], 'muscle', 4000],
  ['flexor_carpi_radialis', 'Flexor carpi radialis', [38460], 'muscle', 4000],
  ['palmaris_longus', 'Palmaris longus', [38463], 'muscle', 2500],
  ['flexor_carpi_ulnaris', 'Flexor carpi ulnaris', [38617, 38619], 'muscle', 4500],
  ['flexor_digitorum_superficialis', 'Flexor digitorum superficialis', [38638, 38640], 'muscle', 6000],
  ['flexor_digitorum_profundus', 'Flexor digitorum profundus', [38479], 'muscle', 5000],
  ['flexor_pollicis_longus', 'Flexor pollicis longus', [38482], 'muscle', 3500],
  ['pronator_quadratus', 'Pronator quadratus', [38454], 'muscle', 2000],
  ['extensor_carpi_radialis_longus', 'Extensor carpi radialis longus', [38495], 'muscle', 3500],
  ['extensor_carpi_radialis_brevis', 'Extensor carpi radialis brevis', [38498], 'muscle', 3500],
  ['extensor_digitorum', 'Extensor digitorum', [38501], 'muscle', 5000],
  ['extensor_digiti_minimi', 'Extensor digiti minimi', [38504], 'muscle', 2000],
  ['extensor_indicis', 'Extensor indicis', [38525], 'muscle', 2000],
  ['supinator', 'Supinator', [38513], 'muscle', 3000],
  ['abductor_pollicis_longus', 'Abductor pollicis longus', [38516], 'muscle', 3000],
  ['extensor_pollicis_brevis', 'Extensor pollicis brevis', [38519], 'muscle', 2000],
  ['extensor_pollicis_longus', 'Extensor pollicis longus', [38522], 'muscle', 2500],
];

/** Structures that define the limb "tissue" used for hulls / skin cropping (excludes trunk context muscles). */
export const LIMB_TISSUE = MESH_STRUCTURES.filter(([id]) => !['pectoralis_major', 'pectoralis_minor', 'clavicle', 'scapula', 'subscapularis', 'supraspinatus', 'infraspinatus', 'teres_minor'].includes(id)).map(([id]) => id);
export const HULL_MUSCLES = MESH_STRUCTURES.filter(([id, , , layer]) => layer === 'muscle' && LIMB_TISSUE.includes(id)).map(([id]) => id);

export const SKIN_FMA = 7163;

// Guided dissection window (fractions along limb; see limb-frame.U)
export const WINDOW = { fTop: 0.14, fBot: 1.38 };
export const HINGE_THETA_DEG = 85;
export const REFLECT_ANGLE_DEG = 128;

/**
 * SCHEMATIC neurovascular courses. NOT segmented anatomy: these are authored centrelines anchored to the
 * loaded muscle envelope, following textbook descriptions. They must be reviewed by a qualified anatomist.
 * pts: [f, thetaDeg]; mode: 'hull' | 'brach' | 'supf'; off: radial offset (mm) from the reference surface.
 */
export const CURVES = [
  { id: 'brachial_artery', kind: 'artery', radius: 2.7, mode: 'hull', off: 1.5, pts: [[0.2, 104], [0.4, 94], [0.6, 80], [0.8, 56], [0.95, 30], [1.03, 14], [1.1, 10]] },
  { id: 'radial_artery', kind: 'artery', radius: 2.0, mode: 'hull', off: 1.5, pts: [[1.1, 10], [1.16, -2], [1.22, -8]] },
  { id: 'ulnar_artery', kind: 'artery', radius: 2.0, mode: 'hull', off: 1.5, pts: [[1.1, 10], [1.16, 20], [1.22, 26]] },
  { id: 'median_nerve', kind: 'nerve', radius: 2.3, mode: 'hull', off: 3.6, pts: [[0.2, 94], [0.4, 86], [0.58, 76], [0.8, 64], [0.95, 38], [1.03, 22], [1.12, 18]] },
  { id: 'ulnar_nerve', kind: 'nerve', radius: 2.1, mode: 'hull', off: 1.0, pts: [[0.2, 112], [0.45, 118], [0.62, 124], [0.85, 142], [1.0, 152], [1.1, 128], [1.18, 112]] },
  { id: 'musculocutaneous_nerve', kind: 'nerve', radius: 1.9, mode: 'brach', off: 1.5, pts: [[0.22, 70], [0.35, 40], [0.6, 8], [0.85, -12], [0.98, -30]] },
  { id: 'lateral_antebrachial_cutaneous_nerve', kind: 'nerve', radius: 1.4, mode: 'supf', off: 1.0, pts: [[0.98, -32], [1.12, -28], [1.3, -18]] },
  { id: 'medial_antebrachial_cutaneous_nerve', kind: 'nerve', radius: 1.4, mode: 'supf', off: 1.0, pts: [[0.6, 100], [0.8, 94], [1.0, 86], [1.3, 72]] },
  { id: 'cephalic_vein', kind: 'vein', radius: 2.6, mode: 'supf', off: 1.1, pts: [[0.16, -66], [0.4, -62], [0.7, -57], [0.95, -46], [1.05, -40], [1.35, -34]] },
  { id: 'basilic_vein', kind: 'vein', radius: 2.8, mode: 'supf', off: 1.1, pts: [[1.36, 62], [1.15, 72], [0.95, 82], [0.62, 92]] },
  { id: 'basilic_vein_deep', kind: 'vein', radius: 2.8, mode: 'hull', off: 2.2, pts: [[0.62, 92], [0.4, 98], [0.2, 104]] },
  { id: 'median_cubital_vein', kind: 'vein', radius: 2.4, mode: 'supf', off: 1.1, pts: [[1.04, -40], [1.0, -14], [0.97, 20], [0.95, 50], [0.95, 82]] },
];
