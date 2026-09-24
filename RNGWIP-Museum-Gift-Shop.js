import * as THREE from './3js_material/three.module.js';
import { GLTFLoader } from './3js_material/GLTFLoader.js';
import { OrbitControls } from './3js_material/OrbitControls.js';
import { RoomEnvironment } from './3js_material/RoomEnvironment.js';

const ASSET_BASE = './3D_assets/';

const MODEL_FILES = [
  // Entry / main spaces
  'MedievalLayer.glb',
  'EntryRoom.glb',
  'EntryRoomDoorRight.glb',
  'EntryRoomDoorLeft.glb',
  'EntryRoomLights.glb',
  'MainRoom.glb',
  'MainRoomPillars.glb',
  'CeilingWireframe.glb',
  'RoomSigilBase.glb',
  'RoomSigil.glb',
  'Backrooms.glb',
  // Gift shop
  'GiftShopRoom.glb',
  'GiftShopSign.glb',
  'GiftShopRegister.glb',
  'GiftShopDesk.glb',
  'GiftShopSprite.glb',
  'VendingMachineRoot.glb',
  // Info desk / props
  'InfoDesk.glb',
  'InfoDeskSign.glb',
  'InfoDeskHelpGear.glb',
  'Mailbox.glb',
  'GiantEye.glb',
  'Speaker1.glb',
  'Speaker2.glb',
  'Ipod.glb',
  'tv1.glb',
  'tv2.glb',
  'tv3.glb',
  'tv4.glb',
  'tv5.glb',
  'tv6.glb',
  'tv7.glb',
  'tv8.glb',
  'tv9.glb',
  'tv10.glb',
  'tv11.glb',
  'tv12.glb',
  'Cactus.glb',
  'VenusFlytrap1.glb',
  'VenusFlytrap2.glb',
  'Tina.glb',
  // Music playbar
  'MusicPlaybar.glb',
  'MusicPlaybarPlayPauseButton.glb',
  'MusicPlaybarRewindButton.glb',
  'MusicPlaybarFastForwardButton.glb',
  'MusicPlaybarCancelButton.glb',
  // Computer desk
  'ComputerTable.glb',
  'Computer.glb',
  'Keyboard.glb',
  'Mouse.glb',
  // Picture frames
  'PictureFrame1.glb',
  'PictureFrame2.glb',
  'PictureFrame3.glb',
  'PictureFrame4.glb',
  'PictureFrame5.glb',
  'PictureFrame6.glb',
  'PictureFrame7.glb',
  'PictureFrame8.glb',
  'PictureFrame9.glb',
  'PictureFrame10.glb',
  'PictureFrame11.glb',
  // Bathroom
  'BathroomDoor.glb',
  'Bathroom.glb',
  'BathroomLights.glb',
  'BathroomMirror.glb',
  'BathroomSink.glb',
  'BathroomKoshinSign.glb',
  'BathroomSprite.glb',
  'BathroomStallWalls.glb',
  'BathroomStallDoor1.glb',
  'BathroomStallDoor2.glb',
  'BathroomStallDoor3.glb',
  'BathroomTPDispensers.glb',
  'BathroomTrashCan.glb',
  'PaperTowelDispenser.glb',
  'PaperTowel.glb',
  'SoapDispenser.glb',
  'Toilet1.glb',
  'Toilet2.glb',
  'Toilet3.glb',
];

// --- TV stack: one unique video per screen, static filling the rest ------
const TV_VIDEO_BASE = './video_assets/';
const TV_VIDEO_FILES = [
  'bed-sheets.mp4',
  'chip-off-the-old-block.mp4',
  'fatal-attraction.mp4',
  'fdl.mp4',
  'freefall-eternal.mp4',
  'trash-talk.mp4',
];
const TV_SCREEN_REGEX = /^tv_screen(\d+)$/;
const TV_COUNT = 12;
const TV_STATIC = Symbol('static');

// Source video → where clicking that screen should take the visitor.
// Clips with no entry here (e.g. trash-talk) just aren't clickable.
const TV_VIDEO_LINKS = {
  'freefall-eternal.mp4': 'https://youtu.be/gXTt8636YTo?si=zIKqkUnrHplE8ZHB',
  'chip-off-the-old-block.mp4': 'https://youtu.be/FQzl8dvcayU?si=Y2vXmdHcFTNazuWB',
  'fatal-attraction.mp4': 'https://youtu.be/-oW8vFOt3RU?si=vnHOhnyzpT4jzCwS',
  'bed-sheets.mp4': 'https://youtu.be/fGqiAUjPe5E?si=9N1sPxQKyIMj2_5V',
  'fdl.mp4': 'https://rngwip.github.io/Fond-du-Lac-Wi/',
};

const clickableTvScreens = [];
const tvRaycaster = new THREE.Raycaster();
let hoveredTvScreen = null;

function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Looks up assetName/nodeName the way every interactive-prop setup function
 * needs to, but — unlike a bare getObjectByName chain — actually says WHY it
 * failed: whether the asset itself never made it into the scene (didn't load,
 * or a naming mismatch against MODEL_FILES) versus the asset loaded fine but
 * no mesh with that exact name exists inside it (wrong assumed name), in
 * which case it lists every real mesh name found so the fix is obvious.
 */
function resolveNamedChild(root, assetName, nodeName, label) {
  const assetRoot = root.getObjectByName(assetName);
  if (!assetRoot) {
    console.warn(
      `[${label}] Asset "${assetName}" is not in the scene at all — either it failed to load, ` +
        `or its name doesn't match what's expected. All top-level asset names currently loaded: ` +
        `${root.children.map((c) => c.name).join(', ')}`
    );
    return null;
  }

  const node = assetRoot.getObjectByName(nodeName);
  if (!node) {
    const meshNames = [];
    assetRoot.traverse((child) => {
      if (child.isMesh) meshNames.push(child.name);
    });
    console.warn(
      `[${label}] Asset "${assetName}" loaded fine, but no mesh named "${nodeName}" exists inside it. ` +
        `Its actual mesh names: ${meshNames.join(', ')}`
    );
    return null;
  }

  return node;
}

// Each of the 6 clips is used exactly once. Every other TV gets static instead
// of a repeat, so no two screens ever show the same clip at the same time.
function buildTvVideoAssignment(tvCount, files) {
  const slotOrder = shuffle(Array.from({ length: tvCount }, (_, i) => i));
  const assignment = new Array(tvCount).fill(TV_STATIC);
  const shuffledFiles = shuffle(files);
  slotOrder.slice(0, shuffledFiles.length).forEach((slot, i) => {
    assignment[slot] = shuffledFiles[i];
  });
  return assignment;
}

const tvVideoAssignment = buildTvVideoAssignment(TV_COUNT, TV_VIDEO_FILES);
const tvVideoTextureCache = new Map();

function getTvVideoTexture(filename) {
  if (tvVideoTextureCache.has(filename)) return tvVideoTextureCache.get(filename);

  const video = document.createElement('video');
  video.src = TV_VIDEO_BASE + filename;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.play().catch(() => {
    const resume = () => {
      video.play();
      window.removeEventListener('pointerdown', resume);
    };
    window.addEventListener('pointerdown', resume);
  });

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  tvVideoTextureCache.set(filename, texture);
  return texture;
}

// --- TV static (for screens not showing one of the 6 clips) --------------
const TV_STATIC_SIZE = 64;
const TV_STATIC_INTERVAL_MS = 80; // ~12fps flicker — cheap to redraw, still reads as noise
let tvStaticTexture = null;
let tvStaticCanvas = null;
let tvStaticCtx = null;
let tvStaticImageData = null;
let tvStaticAccumMs = 0;

function drawTvStaticFrame() {
  const data = tvStaticImageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  tvStaticCtx.putImageData(tvStaticImageData, 0, 0);
}

function getTvStaticTexture() {
  if (tvStaticTexture) return tvStaticTexture;

  tvStaticCanvas = document.createElement('canvas');
  tvStaticCanvas.width = TV_STATIC_SIZE;
  tvStaticCanvas.height = TV_STATIC_SIZE;
  tvStaticCtx = tvStaticCanvas.getContext('2d');
  tvStaticImageData = tvStaticCtx.createImageData(TV_STATIC_SIZE, TV_STATIC_SIZE);
  drawTvStaticFrame();

  tvStaticTexture = new THREE.CanvasTexture(tvStaticCanvas);
  tvStaticTexture.colorSpace = THREE.SRGBColorSpace;
  tvStaticTexture.magFilter = THREE.NearestFilter; // chunky noise pixels, not blurred
  return tvStaticTexture;
}

/** Redraws the static noise on an interval; call once per frame from animate(). */
function updateTvStatic(deltaSeconds) {
  if (!tvStaticTexture) return;
  tvStaticAccumMs += deltaSeconds * 1000;
  if (tvStaticAccumMs < TV_STATIC_INTERVAL_MS) return;
  tvStaticAccumMs = 0;
  drawTvStaticFrame();
  tvStaticTexture.needsUpdate = true;
}

/**
 * Rebuilds a screen mesh's UVs from its own local bounding box so the full
 * texture always fills the whole face edge-to-edge (may stretch slightly —
 * fine here — instead of showing only a cropped sub-rectangle of it).
 */
function remapScreenUVs(geometry) {
  const pos = geometry.attributes.position;
  const count = pos.count;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (let i = 0; i < count; i++) {
    const v = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    for (let a = 0; a < 3; a++) {
      if (v[a] < min[a]) min[a] = v[a];
      if (v[a] > max[a]) max[a] = v[a];
    }
  }

  const span = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  // The flattest axis is the face normal direction; the other two are U/V.
  const flattest = span.indexOf(Math.min(...span));
  const [uAxis, vAxis] = [0, 1, 2].filter((a) => a !== flattest);

  const uv = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const v = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    uv[i * 2] = span[uAxis] > 1e-6 ? (v[uAxis] - min[uAxis]) / span[uAxis] : 0;
    // Inverted: local "up" maps to V=0 for this geometry, which reads upside down
    // once the texture's normal top-is-V1 convention is applied. Flip it back.
    uv[i * 2 + 1] = span[vAxis] > 1e-6 ? 1 - (v[vAxis] - min[vAxis]) / span[vAxis] : 0;
  }

  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
}

/** Assigns a unique video (or static) to every tv_screenN material, filling the whole face. */
function applyRandomTvVideos(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    mats.forEach((mat) => {
      const match = mat?.name?.match(TV_SCREEN_REGEX);
      if (!match) return;
      const tvIndex = parseInt(match[1], 10);
      const assigned = tvVideoAssignment[tvIndex - 1];
      if (assigned === undefined) return;

      remapScreenUVs(child.geometry);
      mat.map = assigned === TV_STATIC ? getTvStaticTexture() : getTvVideoTexture(assigned);
      mat.needsUpdate = true;

      if (assigned !== TV_STATIC && TV_VIDEO_LINKS[assigned]) {
        child.userData.tvLinkUrl = TV_VIDEO_LINKS[assigned];
        clickableTvScreens.push(child);
      }
    });
  });
}

/** Updates which TV screen (if any) is under the cursor, and sets the hand cursor. */
function updateTvScreenHover() {
  if (clickableTvScreens.length === 0) return;

  camera.updateMatrixWorld();
  tvRaycaster.setFromCamera(mouse, camera);
  const hits = tvRaycaster.intersectObjects(clickableTvScreens, false);
  hoveredTvScreen = hits.length > 0 ? hits[0].object : null;
}

function onTvScreenClick() {
  if (uiModalOpen || !hoveredTvScreen) return;
  const url = hoveredTvScreen.userData.tvLinkUrl;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}
// ---------------------------------------------------------------------------

// --- Ambient floor music: cycles through every track, soft fade at each edge ---
const FLOOR_MUSIC_BASE = './archive_music/floor_music/';
const FLOOR_MUSIC_FILES = [
  '100bpm_DOODLE 03.06.25_yumi variation 5_v1.mp3',
  '126bpm_DOODLE 02.06.25_yumi variation 6_v1.mp3',
  '126bpm_DOODLE 02.06.25_yumi variation 6_v1 2.mp3',
  '130bpm_DOODLE #04.06.25_yumi variation 4_v1.mp3',
  '133bpm_DOODLE 07.06.25_yumi variation 1_v1.mp3',
  '150bpm_06.06..25_yumi variation 2_v1.mp3',
  '150bpm_DOODLE_05.06.025_yumi variation 3_v1.mp3',
];
const FLOOR_MUSIC_FADE_SECONDS = 2.5;
const FLOOR_MUSIC_VOLUME = 0.35;

let floorMusicAudio = null;
let floorMusicOrder = [];
let floorMusicIndex = 0;
let floorMusicState = 'idle'; // 'fading-in' | 'playing' | 'fading-out'
let floorMusicFadeElapsed = 0;
// Ducks the ambient floor loop out while the backroom music player (iPod) is
// actively playing, and brings it back once that's paused/stopped. Smoothly
// damped rather than an instant cut so it doesn't feel like a hard mute.
let floorMusicDuckFactor = 1;

function playFloorTrack(index) {
  floorMusicIndex = index;
  floorMusicAudio.src = FLOOR_MUSIC_BASE + encodeURIComponent(floorMusicOrder[floorMusicIndex]);
  floorMusicAudio.currentTime = 0;
  floorMusicAudio.volume = 0;
  floorMusicState = 'fading-in';
  floorMusicFadeElapsed = 0;
  floorMusicAudio.play().catch(() => {
    const resume = () => {
      floorMusicAudio.play();
      window.removeEventListener('pointerdown', resume);
    };
    window.addEventListener('pointerdown', resume);
  });
}

function playNextFloorTrack() {
  let next = floorMusicIndex + 1;
  if (next >= floorMusicOrder.length) {
    floorMusicOrder = shuffle(FLOOR_MUSIC_FILES); // fresh order each time it loops back around
    next = 0;
  }
  playFloorTrack(next);
}

function setupFloorMusic() {
  if (FLOOR_MUSIC_FILES.length === 0) return;
  floorMusicOrder = shuffle(FLOOR_MUSIC_FILES);
  floorMusicAudio = new Audio();
  floorMusicAudio.loop = false;
  floorMusicAudio.volume = 0;
  floorMusicAudio.addEventListener('ended', playNextFloorTrack);
  playFloorTrack(0);
}

/** Ramps volume up at the start of each track and down right before it ends. */
function updateFloorMusic(deltaSeconds) {
  if (!floorMusicAudio) return;

  const duckTarget = musicPlayerIsPlaying ? 0 : 1;
  floorMusicDuckFactor = THREE.MathUtils.damp(floorMusicDuckFactor, duckTarget, 3, deltaSeconds);
  const targetVolume = FLOOR_MUSIC_VOLUME * getEffectiveMusicVolume() * floorMusicDuckFactor;

  if (floorMusicState === 'fading-in') {
    floorMusicFadeElapsed += deltaSeconds;
    const t = Math.min(floorMusicFadeElapsed / FLOOR_MUSIC_FADE_SECONDS, 1);
    floorMusicAudio.volume = t * targetVolume;
    if (t >= 1) floorMusicState = 'playing';
    return;
  }

  if (floorMusicState === 'playing') {
    // Re-applied every frame (not just at the end of a fade) so dragging the
    // settings slider mid-track takes effect immediately.
    floorMusicAudio.volume = targetVolume;
    const duration = floorMusicAudio.duration;
    if (duration && !Number.isNaN(duration) && floorMusicAudio.currentTime >= duration - FLOOR_MUSIC_FADE_SECONDS) {
      floorMusicState = 'fading-out';
      floorMusicFadeElapsed = 0;
    }
    return;
  }

  if (floorMusicState === 'fading-out') {
    floorMusicFadeElapsed += deltaSeconds;
    const t = Math.min(floorMusicFadeElapsed / FLOOR_MUSIC_FADE_SECONDS, 1);
    floorMusicAudio.volume = Math.max(0, (1 - t) * targetVolume);
  }
}
// ---------------------------------------------------------------------------

// --- Backroom iPod/playbar: independent player, separate from the ambient
// floor loop above. Playlist pulled from archive_music/music_player, the raw
// .wav masters in that folder are excluded on purpose (huge, unencoded).
const MUSIC_PLAYER_BASE = './archive_music/music_player/';
const MUSIC_PLAYER_FILES = [
  'LAFFY - AMORPH - 01 d7p.mp3',
  'LAFFY - AMORPH - 02 5rry (feat. Catlaine).mp3',
  'LAFFY - AMORPH - 03 t45t3 0f 5ümm3r.mp3',
  'LAFFY - AMORPH - 04 nük3 8l0550m.mp3',
  'LAFFY - AMORPH - 05 5l0p.mp3',
  'R.N.G.W.I.P. - ...$id€Qu€$t_continuous_mix... (ft. Lil Ouija Board Autocorrect).mp3',
  'R.N.G.W.I.P. - ...ch34t_c0d3... (feat. Lil Ouija Board Autocorrect).mp3',
  'R.N.G.W.I.P. - ...D€TOUR⧸⧸L34KYYY... (feat. Lil Ouija Board Autocorrect).mp3',
  'R.N.G.W.I.P. - ...i_feel_like_tyler_durden_at_the_end_of_fight_club_type-beat....mp3',
  'R.N.G.W.I.P. - ...i_think_we_passed_by_this_already....mp3',
  'R.N.G.W.I.P. - ...in_thru_the_out-door....mp3',
  'R.N.G.W.I.P. - ...stuck_in_a_transient_place....mp3',
  'R.N.G.W.I.P. - (fka)LAFFYYY： Chip Off the Old Block.mp3',
  'R.N.G.W.I.P. - (fka)LAFFYYY： Kitchen\'s On Fire.mp3',
  'R.N.G.W.I.P. - 02 Ya Just Got Got Type Beat.mp3',
  'R.N.G.W.I.P. - 03 Prot & Iola\'s Theme - Panic + Back.mp3',
  'R.N.G.W.I.P. - 04 Joy - Scented Graphics Processor Mixed Into Prot & Iola\'s Theme.mp3',
  'R.N.G.W.I.P. - 08 Prot & Iola\'s Theme - Harder Drop + Juicy Bits.mp3',
  'R.N.G.W.I.P. - 09 Prot & Iola\'s Theme - Darker Theme.mp3',
  'R.N.G.W.I.P. - 10 Some Theme Glitches.mp3',
  'R.N.G.W.I.P. - Catlaine： STICKY (ft. Lil Ouija Board Autocorrect).mp3',
  'R.N.G.W.I.P. - Chip Off The Old Block.mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： Clowncore Type Beat.mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： COKE PERCS MOLLY & LEAN Bootleg Edit (SpaceGhostPurrp SGP Flip) [free dl].mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： EVERYBODY WATCH ME WHIP Adhdcore Edit (Backstreet Boys x Silento Flip).mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： Free Palestine Edit (SEB! Flip).mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： Ice Cream So Good Bootleg Edit (Pinky Doll Flip) (Free Download).mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： It\'s Happening Bootleg Edit (Sean Nicholas Savage Flip).mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： MO BAMBA Bootleg Edit (Sheck Wes “Mo Bamba” Flip) Free DL.mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： Push It Bootleg Edit (Static-X Flip).mp3',
  'R.N.G.W.I.P. - DJ daddyiwannabearockstar： THANKS Bootleg Edit (Joeyy “Thanks” Flip) (free download).mp3',
  'R.N.G.W.I.P. - Fatal Attraction.mp3',
  'R.N.G.W.I.P. - Freefall Eternal.mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： Chicken w⧸ No Sauce (Side A).mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： Chrome Hearse.mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： D.A.R.E. (Uptempo Dubstep Composer Type Beat) (prod. $cam​£​ord_xp96).mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： Escape Plan (Debby Needs a Holiday) [Soundcloud Version].mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： Hunny Bun (feat. LAFFYYY) (prod. Ice4Tee).mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： ih8myself (self luv song tho frfr) (Side B).mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： ineeduhhug (mumblecore based freestyle) (Prod. ice4tee).mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： Lights Camera Action.mp3',
  'R.N.G.W.I.P. - Lil Ouija Board Autocorrect： STFU ：) (feat. DJ PacMan).mp3',
  'R.N.G.W.I.P. - NATURAL.mp3',
  'R.N.G.W.I.P. - P1 vs CPU Lvl 999.mp3',
  'R.N.G.W.I.P. - srorriM oF esuoH.mp3',
  'R.N.G.W.I.P. - TRASH TALK (feat. (fka)LAFFYYY).mp3',
  'R.N.G.W.I.P. - void_jest.help.mp3',
  'R.N.G.W.I.P. - vxba, Big Herm, Lil Ouija Board Autocorrect： No Swag (lounge mix).mp3',
  'R.N.G.W.I.P. - vxba, Big Herm, Lil Ouija Board Autocorrect： No Swag.mp3',
];
const MUSIC_PLAYER_VOLUME = 0.45;
const MUSIC_PLAYER_INTERACT_DISTANCE = 16; // much bigger than the MAX_INTERACT_DISTANCE default — meant to be used from across the room

let musicPlayerAudio = null;
let musicPlayerOrder = [];
let musicPlayerIndex = 0;
let musicPlayerIsPlaying = false;
let musicPlayerLabelEl = null;

// --- Track display: prefer real ID3 metadata (title/artist/embedded art)
// baked into the mp3 itself, read client-side via jsmediatags. If a file has
// no usable tags, fall back to parsing the filename. Filenames are credited
// as "R.N.G.W.I.P." by default, but several of them already bury one of the
// other project aliases in there (either as an explicit "Artist\uFF1A Title"
// segment, or just mentioned somewhere) \u2014 surface that instead of the plain
// RNGWIP umbrella name whenever possible.
const DISPLAY_ARTIST_ALIASES = [
  'Lafayette Vanderkin-Jus',
  'Lil Ouija Board Autocorrect',
  'DJ daddyiwannabearockstar',
  'Scamlord_xp96',
  'fkaLAFFYYY',
  'LAFFYYY',
  'LAFFY',
];

function parseTrackDisplay(filename) {
  const base = filename.replace(/\.mp3$/i, '');

  // "R.N.G.W.I.P. - <artist>\uFF1A <title>" (fullwidth colon) \u2014 an explicit
  // featured/alter-ego credit baked right into the filename.
  const credited = base.match(/^(?:R\.N\.G\.W\.I\.P\.|LAFFY)\s*-\s*(.+?)\uFF1A\s*(.+)$/);
  if (credited) return { artist: credited[1].trim(), title: credited[2].trim() };

  const strippedRngwip = base.replace(/^R\.N\.G\.W\.I\.P\.\s*-\s*/i, '');
  const laffyMatch = base.match(/^LAFFY\s*-\s*(.+)$/i);

  // No explicit credit segment \u2014 check if another project alias is
  // mentioned anywhere in the filename and prefer that over plain RNGWIP.
  const lower = base.toLowerCase();
  for (const alias of DISPLAY_ARTIST_ALIASES) {
    if (lower.includes(alias.toLowerCase())) {
      return { artist: alias, title: (laffyMatch ? laffyMatch[1] : strippedRngwip).trim() };
    }
  }

  if (laffyMatch) return { artist: 'LAFFY', title: laffyMatch[1].trim() };
  if (strippedRngwip !== base) return { artist: 'R.N.G.W.I.P.', title: strippedRngwip.trim() };
  return { artist: null, title: base };
}

let musicPlayerLoadToken = 0;
let musicPlayerNowPlaying = null; // { artist, title }

/** Reads embedded ID3 tags (title/artist/cover art) off the mp3 itself, if any exist. */
function readTrackTags(url, token) {
  if (typeof window.jsmediatags === 'undefined') return; // CDN script didn't load \u2014 filename fallback stands
  window.jsmediatags.read(url, {
    onSuccess: (tag) => {
      if (token !== musicPlayerLoadToken || !musicPlayerNowPlaying) return; // track changed since this was requested
      const info = tag.tags || {};
      let changed = false;
      if (info.title) {
        musicPlayerNowPlaying.title = info.title;
        changed = true;
      }
      if (info.artist) {
        musicPlayerNowPlaying.artist = info.artist;
        changed = true;
      }
      // Embedded cover art (info.picture) is intentionally not used — both
      // the HUD and the in-scene iPod screen are text-only by design now.
      if (changed) updateMusicPlayerLabel();
    },
    onError: () => {
      // No embedded tags (or a tag format jsmediatags can't parse) \u2014 the
      // filename-based fallback set in playMusicPlayerTrack already stands.
    },
  });
}

function updateMusicPlayerLabel() {
  const info = musicPlayerIsPlaying ? musicPlayerNowPlaying : null;

  if (musicPlayerLabelEl) {
    musicPlayerLabelEl.style.opacity = info ? '1' : '0';
    if (info) {
      musicPlayerLabelEl.textContent = info.artist
        ? `${'\u25B6'} ${info.artist} \u2014 ${info.title}`
        : `${'\u25B6'} ${info.title}`;
    }
  }

  // Also mirrors onto the iPod's in-scene screen texture, if it resolved.
  drawIpodScreen(info);
}

function playMusicPlayerTrack(index) {
  if (!musicPlayerAudio || musicPlayerOrder.length === 0) return;
  musicPlayerIndex = ((index % musicPlayerOrder.length) + musicPlayerOrder.length) % musicPlayerOrder.length;
  const filename = musicPlayerOrder[musicPlayerIndex];
  const url = MUSIC_PLAYER_BASE + encodeURIComponent(filename);
  musicPlayerAudio.src = url;
  musicPlayerAudio.currentTime = 0;
  musicPlayerIsPlaying = true;
  musicPlayerAudio.play().catch(() => {
    const resume = () => {
      musicPlayerAudio.play();
      window.removeEventListener('pointerdown', resume);
    };
    window.addEventListener('pointerdown', resume);
  });

  musicPlayerLoadToken += 1;
  musicPlayerNowPlaying = { ...parseTrackDisplay(filename) };
  readTrackTags(url, musicPlayerLoadToken);

  updateMusicPlayerLabel();
}

function toggleMusicPlayerPlayback() {
  if (!musicPlayerAudio) return;
  if (!musicPlayerAudio.src) {
    playMusicPlayerTrack(0);
    return;
  }
  if (musicPlayerIsPlaying) {
    musicPlayerAudio.pause();
    musicPlayerIsPlaying = false;
  } else {
    musicPlayerAudio.play().catch(() => {});
    musicPlayerIsPlaying = true;
  }
  updateMusicPlayerLabel();
}

function stopMusicPlayer() {
  if (!musicPlayerAudio) return;
  musicPlayerAudio.pause();
  musicPlayerAudio.currentTime = 0;
  musicPlayerIsPlaying = false;
  updateMusicPlayerLabel();
}

// Every one of these assets ships as its own single/dual-mesh glb, and every
// node in each is single-primitive, so the live (sanitized) names are just
// the dotted raw names with the dots stripped — no multi-mesh workaround
// needed here, unlike BathroomDoor/Computer.
function setupMusicPlayer(root) {
  const playPause = resolveNamedChild(root, 'MusicPlaybarPlayPauseButton', 'play002', 'setupMusicPlayer');
  const rewind = resolveNamedChild(root, 'MusicPlaybarRewindButton', 'Polygon005', 'setupMusicPlayer');
  const fastForward = resolveNamedChild(root, 'MusicPlaybarFastForwardButton', 'Polygon006', 'setupMusicPlayer');
  const cancel = resolveNamedChild(root, 'MusicPlaybarCancelButton', 'Text008', 'setupMusicPlayer');

  musicPlayerOrder = shuffle(MUSIC_PLAYER_FILES);
  musicPlayerAudio = new Audio();
  musicPlayerAudio.volume = MUSIC_PLAYER_VOLUME;
  musicPlayerAudio.addEventListener('ended', () => playMusicPlayerTrack(musicPlayerIndex + 1));

  musicPlayerLabelEl = document.createElement('div');
  Object.assign(musicPlayerLabelEl.style, {
    position: 'fixed',
    left: '18px',
    bottom: '18px',
    maxWidth: '320px',
    padding: '10px 14px',
    background: 'rgba(5,8,6,0.85)',
    color: '#6bffe0',
    border: '1px solid #35ffcf',
    borderRadius: '4px',
    boxShadow: '0 0 14px rgba(53,255,207,0.25)',
    fontFamily: 'monospace',
    fontSize: '13px',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.25s ease',
    zIndex: '20',
  });
  document.body.appendChild(musicPlayerLabelEl);

  // These are small icon meshes, easy to miss by a few pixels — register the
  // real mesh AND a generous invisible hitbox sphere at the same spot for
  // each, and give both a much bigger interact radius than the doors/toilet
  // default so the buttons work from across the room, not just up close.
  const MUSIC_BUTTON_HITBOX_RADIUS = 0.35;
  const registerMusicButton = (mesh, onActivate) => {
    if (!mesh) return;
    mesh.userData.onActivate = onActivate;
    mesh.userData.interactDistance = MUSIC_PLAYER_INTERACT_DISTANCE;
    clickableSceneObjects.push(mesh);
    const hb = addClickHitbox(mesh, MUSIC_BUTTON_HITBOX_RADIUS);
    hb.userData.onActivate = onActivate;
    hb.userData.interactDistance = MUSIC_PLAYER_INTERACT_DISTANCE;
    clickableSceneObjects.push(hb);
  };

  registerMusicButton(playPause, () => toggleMusicPlayerPlayback());
  registerMusicButton(rewind, () => playMusicPlayerTrack(musicPlayerIndex - 1));
  registerMusicButton(fastForward, () => playMusicPlayerTrack(musicPlayerIndex + 1));
  registerMusicButton(cancel, () => stopMusicPlayer());
}

// --- iPod horns: fix color + duplicate the missing second horn -------------
// Confirmed via glb inspection: the export only has ONE 'horns' mesh (flat
// white material, no texture) where the design calls for a symmetric pair.
// Both are fixable here without a re-export: clone it, mirror across the
// iPod's local X axis, and recolor both red.
// Just the color fix for now — the plan is to re-export the model with a real
// second horn already modeled, so cloning/mirroring one here would leave a
// stray third horn floating around once that lands. Delete this whole
// function once the re-export ships with red material baked in.
function setupIpodHorns(root) {
  const horn = resolveNamedChild(root, 'Ipod', 'horns', 'setupIpodHorns');
  if (!horn) return;

  const mat = (Array.isArray(horn.material) ? horn.material[0] : horn.material)?.clone();
  if (mat) {
    mat.color.set(0xb3121f);
    mat.needsUpdate = true;
    horn.material = mat;
  }
}

// --- iPod screen: mirrors the bottom-left "now playing" HUD onto the actual
// in-scene screen mesh (not the pink shell) as a little retro LCD readout.
let ipodScreenCanvas = null;
let ipodScreenCtx = null;
let ipodScreenTexture = null;

// Actually measured from the raw glb (not a guess): ipod_screen002's mesh
// only uses a SUB-RECTANGLE of the 0..1 UV space — roughly U 0.1385–0.875,
// V 0.4865–0.7635 — instead of the full 0..1 square a screen texture usually
// assumes. Plugging a normal full-canvas texture straight in (as before)
// meant the mesh was sampling a narrow, off-center band of the canvas and
// stretching it across the whole screen — that's the "weird"/illegible
// result. texture.offset/.repeat below remaps that exact sub-rectangle back
// onto the full canvas so what's drawn actually fills the visible screen.
// (The mesh's own UV unwrap for this part isn't a perfectly clean rectangle
// — it's a 12-vertex rounded-rect fan — so some minor warping right at the
// rounded corners is expected even after this; a from-scratch flat/front
// unwrap on a re-export would be the real long-term fix if it still looks
// slightly off.)
const IPOD_SCREEN_UV_BOUNDS = { uMin: 0.1385033, uMax: 0.875, vMin: 0.48649669, vMax: 0.76350331 };
// Matches the screen mesh's own local width:height ratio (~1.97:1) so the
// drawn text doesn't come out stretched.
const IPOD_SCREEN_CANVAS_WIDTH = 256;
const IPOD_SCREEN_CANVAS_HEIGHT = 130;

function setupIpodScreen(root) {
  const screenMesh = resolveNamedChild(root, 'Ipod', 'ipod_screen002', 'setupIpodScreen');
  if (!screenMesh) return;

  ipodScreenCanvas = document.createElement('canvas');
  ipodScreenCanvas.width = IPOD_SCREEN_CANVAS_WIDTH;
  ipodScreenCanvas.height = IPOD_SCREEN_CANVAS_HEIGHT;
  ipodScreenCtx = ipodScreenCanvas.getContext('2d');
  ipodScreenTexture = new THREE.CanvasTexture(ipodScreenCanvas);
  ipodScreenTexture.colorSpace = THREE.SRGBColorSpace;
  ipodScreenTexture.wrapS = THREE.ClampToEdgeWrapping;
  ipodScreenTexture.wrapT = THREE.ClampToEdgeWrapping;
  const { uMin, uMax, vMin, vMax } = IPOD_SCREEN_UV_BOUNDS;
  ipodScreenTexture.repeat.set(1 / (uMax - uMin), 1 / (vMax - vMin));
  ipodScreenTexture.offset.set(-uMin / (uMax - uMin), -vMin / (vMax - vMin));

  const mat = (Array.isArray(screenMesh.material) ? screenMesh.material[0] : screenMesh.material)?.clone();
  if (mat) {
    mat.map = ipodScreenTexture;
    mat.color.set(0xffffff);
    mat.emissive = new THREE.Color(0x123528);
    mat.emissiveIntensity = 0.6;
    mat.toneMapped = false;
    mat.needsUpdate = true;
    screenMesh.material = mat;
  }

  drawIpodScreen(null);
}

function wrapLineToArray(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks font size until every wrapped line of `inputLines` fits within maxWidth/maxHeight. */
function fitTextBlock(ctx, inputLines, maxWidth, maxHeight, maxFont, minFont) {
  for (let fontSize = maxFont; fontSize >= minFont; fontSize -= 1) {
    ctx.font = `bold ${fontSize}px monospace`;
    const lineHeight = fontSize * 1.3;
    const wrapped = inputLines.flatMap((line) => wrapLineToArray(ctx, line, maxWidth));
    if (wrapped.length * lineHeight <= maxHeight) {
      return { fontSize, lineHeight, wrapped };
    }
  }
  ctx.font = `bold ${minFont}px monospace`;
  return {
    fontSize: minFont,
    lineHeight: minFont * 1.3,
    wrapped: inputLines.flatMap((line) => wrapLineToArray(ctx, line, maxWidth)),
  };
}

/** Redraws the iPod's screen texture. Pass null for the idle "nothing playing" state, or
 * an { artist, title } display record (see musicPlayerNowPlaying) — text only, no art,
 * sized to always fit the screen regardless of how long the track name is. */
function drawIpodScreen(info) {
  if (!ipodScreenCtx) return;
  const ctx = ipodScreenCtx;
  const w = ipodScreenCanvas.width;
  const h = ipodScreenCanvas.height;

  ctx.fillStyle = '#0d1a12';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(107,255,224,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  if (info) {
    const maxWidth = w - 36;
    const maxHeight = h - 36;
    const inputLines = info.artist ? [info.artist, info.title] : [info.title];
    const { lineHeight, wrapped } = fitTextBlock(ctx, inputLines, maxWidth, maxHeight, 34, 11);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#6bffe0';
    ctx.shadowColor = '#35ffcf';
    ctx.shadowBlur = 6;
    const startY = h / 2 - ((wrapped.length - 1) * lineHeight) / 2;
    wrapped.forEach((line, i) => ctx.fillText(line, w / 2, startY + i * lineHeight));
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = 'rgba(107,255,224,0.5)';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('— no track playing —', w / 2, h / 2);
  }

  ipodScreenTexture.needsUpdate = true;
}
// ---------------------------------------------------------------------------

// --- Bathroom interactions: swing doors, fairy warning, toilet teleport ---
// Click radius — doors/toilet only respond when the player is actually close,
// not raycast-visible from across the room.
const MAX_INTERACT_DISTANCE = 6;
const sceneRaycaster = new THREE.Raycaster();
const clickableSceneObjects = [];
let hoveredSceneObject = null;

// Swing angle is a guess (doors were exported with hinge pivots already at the
// edge, confirmed via the glb geometry, so a plain Y-axis rotation works) —
// if a door swings into a wall instead of the room, just flip that door's sign.
// Live (GLTFLoader-sanitized) names confirmed via console — dots are stripped
// and spaces become underscores relative to the raw glb JSON. BathroomDoor's
// mesh has multiple material slots, so GLTFLoader named its children after the
// underlying mesh DATA block ('Cube396' etc.), not the door's own node name —
// it needs all of its parts resolved and rotated together via `nodes` below.
//
// Each door was baked with a different resting yaw in Blender (checked via the
// raw glb: BathroomDoor -90°, Stall1 180°, Stall2 -90°, Stall3 -135°) — only
// Stall2 happened to land on the angle that reads as "shut." closedYaw forces
// every door to snap to that same shared reference the moment it loads, so
// all four look closed at rest regardless of what was baked in.
const DOOR_CLOSED_YAW = -Math.PI / 2;
const SWING_DOORS = [
  { asset: 'BathroomDoor', nodes: ['Cube396', 'Cube396_1', 'Cube396_2'], openAngle: -Math.PI * 0.55, closedYaw: DOOR_CLOSED_YAW },
  { asset: 'BathroomStallDoor1', node: 'DOOR_1002', openAngle: Math.PI * 0.55, closedYaw: DOOR_CLOSED_YAW },
  { asset: 'BathroomStallDoor2', node: 'DOOR_2002', openAngle: Math.PI * 0.55, closedYaw: DOOR_CLOSED_YAW },
  { asset: 'BathroomStallDoor3', node: 'DOOR_3002', openAngle: Math.PI * 0.55, closedYaw: DOOR_CLOSED_YAW },
];
const DOOR_SWING_LAMBDA = 6; // higher = snappier ease via THREE.MathUtils.damp
const doorStates = [];

function setupSwingDoors(root) {
  for (const cfg of SWING_DOORS) {
    let doorObject;
    let clickTargets;

    if (cfg.nodes) {
      const parts = cfg.nodes
        .map((nodeName) => resolveNamedChild(root, cfg.asset, nodeName, 'setupSwingDoors'))
        .filter(Boolean);
      if (parts.length === 0) continue;
      // All parts share one hinge — rotate their common parent and let every
      // part act as a click target for it.
      doorObject = parts[0].parent || parts[0];
      clickTargets = parts;
    } else {
      doorObject = resolveNamedChild(root, cfg.asset, cfg.node, 'setupSwingDoors');
      if (!doorObject) continue;
      clickTargets = [doorObject];
    }

    // Snap to the shared closed reference immediately so it renders shut on
    // load instead of whatever ajar angle happened to be baked in.
    doorObject.rotation.y = cfg.closedYaw;

    const state = {
      object: doorObject,
      closedY: cfg.closedYaw,
      openAngle: cfg.openAngle,
      isOpen: false,
    };
    const toggle = () => {
      state.isOpen = !state.isOpen;
    };
    for (const target of clickTargets) {
      target.userData.onActivate = toggle;
      clickableSceneObjects.push(target);
    }
    doorStates.push(state);
  }
}

function updateSwingDoors(deltaSeconds) {
  for (const state of doorStates) {
    const targetY = state.closedY + (state.isOpen ? state.openAngle : 0);
    state.object.rotation.y = THREE.MathUtils.damp(
      state.object.rotation.y,
      targetY,
      DOOR_SWING_LAMBDA,
      deltaSeconds
    );
  }
}

// --- Entry room sliding glass doors: shut by default, slide open when the
// player gets close, slide back shut once they step away. No click needed.
//
// Axis/direction/distance are a best guess, not confirmed live (same
// situation the swing doors' hinge angles started in) — each door is grabbed
// as its own whole asset (EntryRoomDoorLeft / EntryRoomDoorRight are single
// props, not multi-part like BathroomDoor), then slid along local X, left
// and right sliding away from each other. If they slide the wrong axis
// (e.g. should be Z) or the wrong direction, or don't move far enough to
// clear the frame, it's a one-line fix per door below.
const SLIDING_DOORS = [
  { asset: 'EntryRoomDoorLeft', axis: 'x', sign: -1, slideDistance: 1.4 },
  { asset: 'EntryRoomDoorRight', axis: 'x', sign: 1, slideDistance: 1.4 },
];
const SLIDING_DOOR_OPEN_RADIUS = 7;
const SLIDING_DOOR_LAMBDA = 5;
const slidingDoorStates = [];

function setupSlidingDoors(root) {
  for (const cfg of SLIDING_DOORS) {
    const doorObject = root.getObjectByName(cfg.asset);
    if (!doorObject) {
      console.warn(`[setupSlidingDoors] Asset "${cfg.asset}" is not in the scene — check it loaded / the name matches.`);
      continue;
    }
    const worldPos = new THREE.Vector3();
    doorObject.getWorldPosition(worldPos);
    slidingDoorStates.push({
      object: doorObject,
      axisKey: cfg.axis,
      sign: cfg.sign,
      slideDistance: cfg.slideDistance,
      basePos: doorObject.position[cfg.axis],
      worldPos,
      isOpen: false,
    });
  }
}

function updateSlidingDoors(deltaSeconds) {
  for (const state of slidingDoorStates) {
    state.isOpen = camera.position.distanceTo(state.worldPos) <= SLIDING_DOOR_OPEN_RADIUS;
    const target = state.basePos + (state.isOpen ? state.slideDistance * state.sign : 0);
    state.object.position[state.axisKey] = THREE.MathUtils.damp(
      state.object.position[state.axisKey],
      target,
      SLIDING_DOOR_LAMBDA,
      deltaSeconds
    );
  }
}
// ---------------------------------------------------------------------------

// Second toilet's water — clicking it teleports down to the Backrooms.
function setupToiletTeleport(root) {
  const waterObject = resolveNamedChild(root, 'Toilet2', 'Sphere088', 'setupToiletTeleport');
  if (!waterObject) return;
  waterObject.userData.onActivate = () => teleportToBackrooms();
  clickableSceneObjects.push(waterObject);
}

function teleportToBackrooms() {
  const backroomsRoot = museumRoot.getObjectByName('Backrooms');
  if (!backroomsRoot) {
    console.warn('Backrooms asset not found — cannot teleport.');
    return;
  }
  const box = new THREE.Box3().setFromObject(backroomsRoot);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  camera.position.set(center.x, center.y, center.z);
  baseEyeHeight = center.y;
  verticalVelocity = 0;
  isAirborne = false;
  jumpsRemaining = maxJumps;
}

// Screen-space fallback for the small "icon" style targets (music buttons,
// computer button, settings gear, mailbox) — anything that opted into a
// custom userData.interactDistance. A raw raycast against a small hitbox
// sphere shrinks to just a few screen pixels the farther away the camera
// is, so from across a room you basically have to land the cursor
// pixel-perfect on it. This instead finds whichever opted-in target's
// on-screen position is nearest the cursor, within a generous pixel
// radius, regardless of how small it looks at that distance.
const ICON_HOVER_PIXEL_RADIUS = 46;
const _iconWorldPos = new THREE.Vector3();
function findScreenSpaceHoverTarget() {
  let best = null;
  let bestPixelDist = ICON_HOVER_PIXEL_RADIUS;
  const halfW = window.innerWidth / 2;
  const halfH = window.innerHeight / 2;
  const mousePxX = mouse.x * halfW + halfW;
  const mousePxY = -mouse.y * halfH + halfH;

  for (const obj of clickableSceneObjects) {
    if (obj.userData.interactDistance === undefined) continue; // doors/toilet keep pure raycasting
    if (!obj.userData.isClickHitbox) continue; // trust placed hitboxes only — a raw mesh's own
    // origin can sit somewhere visually unhelpful (e.g. the mailbox's origin is down at the
    // post's base), which would bias this toward the wrong part of the object.
    obj.getWorldPosition(_iconWorldPos);
    if (camera.position.distanceTo(_iconWorldPos) > obj.userData.interactDistance) continue;

    const projected = _iconWorldPos.clone().project(camera);
    if (projected.z > 1 || projected.z < -1) continue; // behind camera or outside clip range
    const px = projected.x * halfW + halfW;
    const py = -projected.y * halfH + halfH;
    const dist = Math.hypot(px - mousePxX, py - mousePxY);
    if (dist < bestPixelDist) {
      bestPixelDist = dist;
      best = obj;
    }
  }
  return best;
}

/** Hover + click affordance for doors and the toilet water, mirroring the TV screen pattern. */
function updateSceneHover() {
  if (clickableSceneObjects.length === 0) return;

  camera.updateMatrixWorld();
  sceneRaycaster.setFromCamera(mouse, camera);
  const hits = sceneRaycaster.intersectObjects(clickableSceneObjects, false);
  // Per-object override (see userData.interactDistance) — small stuff you're
  // meant to operate from across a room (like the music player) can set a
  // bigger radius than the default used for doors/toilets.
  const nearHit = hits.find((hit) => hit.distance <= (hit.object.userData.interactDistance ?? MAX_INTERACT_DISTANCE));
  hoveredSceneObject = nearHit ? nearHit.object : findScreenSpaceHoverTarget();
}

function onSceneClick() {
  if (uiModalOpen || !hoveredSceneObject) return;
  hoveredSceneObject.userData.onActivate?.();
}

/** One cursor, driven by whichever hover system (TV or bathroom) currently has a target. */
function updateCursorStyle() {
  const pointer = Boolean(hoveredTvScreen || hoveredSceneObject);
  renderer.domElement.style.cursor = pointer ? 'pointer' : '';
}

// --- NPC dialogue: proximity-triggered speech bubbles for the museum's cast ---
// Anchored on each NPC's own group node and re-measured via bounding box each
// frame (rather than a raw local translation) since these roots sit at local
// (0,0,0) with the real character offset baked into their children/animation.
const NPC_DIALOGUE_CONFIGS = [
  {
    key: 'bathroomFairy',
    asset: 'BathroomSprite',
    node: 'Icosphere005',
    radius: 11,
    text: "Oh, no! We've had some issues with the plumbing lately. Something about music coming from the pipes. I wouldn't use the second door if I were you heheh >~~~<",
  },
  {
    key: 'giftShopFairy',
    asset: 'GiftShopSprite',
    node: 'Icosphere004',
    radius: 11,
    text: "Hi! Welcome to our Gift Shop! Sorry, we don't have much in stock right now - but we might have somethings available in the Swag Machine!",
  },
  {
    key: 'lucy',
    asset: 'Tina',
    node: 'jacket_1003',
    radius: 12,
    text: "Hebo! Welcome to the rngwip archives sponsored by this is not 4ever, brought to you by corporation corpse incorporated. Sorry, we could only get part of you right now. We're working on getting your physical body integrated to this plane asap. It's just, uhm, hehe, going a lil bit slow rn...",
  },
];

const npcDialogues = [];
const _npcBox = new THREE.Box3();
const _npcCenter = new THREE.Vector3();
const _npcScreenPos = new THREE.Vector3();

function setupNpcDialogue(root) {
  for (const cfg of NPC_DIALOGUE_CONFIGS) {
    const object = resolveNamedChild(root, cfg.asset, cfg.node, 'setupNpcDialogue');
    if (!object) continue;

    const el = document.createElement('div');
    el.textContent = cfg.text;
    Object.assign(el.style, {
      position: 'fixed',
      maxWidth: '320px',
      padding: '14px 18px',
      background: 'rgba(5,8,6,0.92)',
      color: '#6bffe0',
      borderRadius: '4px',
      border: '1px solid #35ffcf',
      boxShadow: '0 0 18px rgba(53,255,207,0.3)',
      fontFamily: 'monospace',
      fontSize: '16px',
      lineHeight: '1.45',
      letterSpacing: '0.2px',
      textAlign: 'left',
      pointerEvents: 'none',
      opacity: '0',
      transform: 'translate(-50%, -100%)',
      transition: 'opacity 0.15s ease',
      zIndex: '20',
    });
    document.body.appendChild(el);

    npcDialogues.push({ object, radius: cfg.radius, el, visible: false });
  }
}

function setNpcBubbleVisible(entry, visible) {
  if (entry.visible === visible) return;
  entry.visible = visible;
  entry.el.style.opacity = visible ? '1' : '0';
}

function updateNpcDialogue() {
  for (const entry of npcDialogues) {
    _npcBox.setFromObject(entry.object);
    if (_npcBox.isEmpty()) continue;
    _npcBox.getCenter(_npcCenter);

    const distance = _npcCenter.distanceTo(camera.position);
    if (distance > entry.radius) {
      setNpcBubbleVisible(entry, false);
      continue;
    }

    _npcScreenPos.copy(_npcCenter);
    _npcScreenPos.y += 1.3; // float above the NPC's head
    _npcScreenPos.project(camera);

    if (_npcScreenPos.z > 1) {
      // Behind the camera — projected screen coords would be mirrored/garbage.
      setNpcBubbleVisible(entry, false);
      continue;
    }

    setNpcBubbleVisible(entry, true);
    entry.el.style.left = `${(_npcScreenPos.x * 0.5 + 0.5) * window.innerWidth}px`;
    entry.el.style.top = `${(-_npcScreenPos.y * 0.5 + 0.5) * window.innerHeight}px`;
  }
}
// ---------------------------------------------------------------------------

// --- Computer terminal: idle glow prompts a click; login is a locked prop for now ---
const COMPUTER_GLOW_COLOR = new THREE.Color(0x35ffcf);
const COMPUTER_BLINK_HZ = 0.6; // slow standby breathing pulse, not a strobe
let computerScreenMaterials = [];
let computerScreenObject = null;
let computerBlinkClock = 0;
let computerOn = false;

let uiModalOpen = false;
// Whichever modal is currently open gets to decide what Escape does — set
// this in that modal's open function, clear it in its close function. Avoids
// Escape hard-coding to one modal (e.g. closing the computer's modal, camera
// zoom and all, while the settings panel is what's actually open).
let activeModalCloser = null;
let computerModalEl = null;
let computerPasswordInput = null;
let computerModalMessageEl = null;

function buildComputerModal() {
  computerModalEl = document.createElement('div');
  Object.assign(computerModalEl.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '30',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    width: '320px',
    padding: '20px',
    background: '#050806',
    border: '2px solid #35ffcf',
    borderRadius: '6px',
    boxShadow: '0 0 24px rgba(53,255,207,0.35)',
    fontFamily: 'monospace',
    color: '#35ffcf',
  });

  const title = document.createElement('div');
  title.textContent = 'RNGWIP TERMINAL — v0.1';
  title.style.marginBottom = '10px';
  title.style.fontWeight = 'bold';

  const prompt = document.createElement('div');
  prompt.textContent = 'ENTER ACCESS CODE:';
  prompt.style.fontSize = '12px';
  prompt.style.marginBottom = '8px';
  prompt.style.opacity = '0.85';

  computerPasswordInput = document.createElement('input');
  computerPasswordInput.type = 'password';
  Object.assign(computerPasswordInput.style, {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px',
    background: '#0a120f',
    border: '1px solid #35ffcf',
    color: '#35ffcf',
    fontFamily: 'monospace',
    fontSize: '13px',
    outline: 'none',
    marginBottom: '10px',
  });
  computerPasswordInput.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') attemptComputerLogin();
    if (event.key === 'Escape') closeComputerModal();
  });

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '8px';

  const submitButton = document.createElement('button');
  submitButton.textContent = 'ENTER';
  const closeButton = document.createElement('button');
  closeButton.textContent = 'CLOSE';
  for (const btn of [submitButton, closeButton]) {
    Object.assign(btn.style, {
      flex: '1',
      padding: '8px',
      background: 'transparent',
      border: '1px solid #35ffcf',
      color: '#35ffcf',
      fontFamily: 'monospace',
      cursor: 'pointer',
    });
  }
  submitButton.addEventListener('click', attemptComputerLogin);
  closeButton.addEventListener('click', closeComputerModal);
  buttonRow.appendChild(submitButton);
  buttonRow.appendChild(closeButton);

  computerModalMessageEl = document.createElement('div');
  Object.assign(computerModalMessageEl.style, {
    marginTop: '10px',
    fontSize: '12px',
    minHeight: '14px',
    color: '#ff5f6d',
  });

  panel.appendChild(title);
  panel.appendChild(prompt);
  panel.appendChild(computerPasswordInput);
  panel.appendChild(buttonRow);
  panel.appendChild(computerModalMessageEl);
  computerModalEl.appendChild(panel);
  document.body.appendChild(computerModalEl);
}

function attemptComputerLogin() {
  // Locked for now — every attempt fails, on purpose.
  computerModalMessageEl.textContent = 'ACCESS DENIED — this terminal is still booting up.';
  computerPasswordInput.value = '';
}

// --- Camera zoom tween, used to push the view in toward the computer screen
// while the terminal modal is open, then pull it back out on close. Runs only
// while uiModalOpen is true, so nothing else is fighting for camera control
// (updateFirstPersonMovement bails out early in that state).
const COMPUTER_ZOOM_DURATION = 0.6; // seconds
const COMPUTER_ZOOM_DISTANCE = 1.6; // how close the camera ends up from the screen
let computerZoomState = null; // { elapsed, fromPos, fromQuat, toPos, toQuat, onComplete }
let computerPreZoomPos = null;
let computerPreZoomQuat = null;

function tweenCameraTo(toPos, toQuat, onComplete) {
  computerZoomState = {
    elapsed: 0,
    fromPos: camera.position.clone(),
    fromQuat: camera.quaternion.clone(),
    toPos,
    toQuat,
    onComplete,
  };
}

function updateComputerZoom(deltaSeconds) {
  if (!computerZoomState) return;
  const state = computerZoomState;
  state.elapsed += deltaSeconds;
  const t = Math.min(state.elapsed / COMPUTER_ZOOM_DURATION, 1);
  const eased = t * t * (3 - 2 * t); // smoothstep
  camera.position.lerpVectors(state.fromPos, state.toPos, eased);
  camera.quaternion.slerpQuaternions(state.fromQuat, state.toQuat, eased);
  if (t >= 1) {
    computerZoomState = null;
    state.onComplete?.();
  }
}

function openComputerModal() {
  computerOn = true;
  uiModalOpen = true; // freeze movement/mouselook immediately, before the zoom starts
  activeModalCloser = closeComputerModal;
  computerPreZoomPos = camera.position.clone();
  computerPreZoomQuat = camera.quaternion.clone();

  // Aim at the confirmed power-button position(s), not the guessed
  // COMPUTER_3006 "screen" node — that name was never actually verified
  // (unlike the buttons, which were confirmed via real world-space math),
  // and if it's wrong the camera flies toward an arbitrary point and can
  // end up clipped inside nearby geometry, which is exactly what a wrong
  // zoom target looks like. Since you can only click a button you already
  // have clear line of sight to, its position is a guaranteed-safe target.
  const targetPos = new THREE.Vector3();
  if (computerPowerButtonParts.length > 0) {
    const partPos = new THREE.Vector3();
    computerPowerButtonParts.forEach((part) => {
      part.getWorldPosition(partPos);
      targetPos.add(partPos);
    });
    targetPos.divideScalar(computerPowerButtonParts.length);
  } else if (computerScreenObject) {
    computerScreenObject.getWorldPosition(targetPos);
  }

  const dir = new THREE.Vector3().subVectors(targetPos, computerPreZoomPos);
  const fullDist = dir.length() || 1;
  dir.normalize();
  const stopDist = Math.min(COMPUTER_ZOOM_DISTANCE, Math.max(fullDist - 0.4, 0.6));
  // Always advance forward a bit, even if the player clicked from very close
  // range (stopDist could otherwise exceed fullDist and push the camera back).
  const advance = Math.max(fullDist - stopDist, 0.15);
  const toPos = computerPreZoomPos.clone().addScaledVector(dir, advance);
  const lookMatrix = new THREE.Matrix4().lookAt(toPos, targetPos, WORLD_UP);
  const toQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

  tweenCameraTo(toPos, toQuat, () => {
    computerModalEl.style.display = 'flex';
    computerModalMessageEl.textContent = '';
    computerPasswordInput.value = '';
    window.requestAnimationFrame(() => computerPasswordInput.focus());
  });
}

function closeComputerModal() {
  computerModalEl.style.display = 'none';
  activeModalCloser = null;
  if (computerPreZoomPos && computerPreZoomQuat) {
    tweenCameraTo(computerPreZoomPos, computerPreZoomQuat, () => {
      uiModalOpen = false;
    });
  } else {
    uiModalOpen = false;
  }
}

// Live names confirmed via console — dots stripped, spaces -> underscores, and
// (since this mesh has multiple material slots) multi-primitive children named
// after the underlying mesh DATA block rather than their own node name.
// Checked the actual world-space layout: Cylinder068 + Cylinder069 sit right
// next to each other (their world Z only differs by ~0.17, vs. ~2 units from
// Cylinder070) — that's "the cylinder" on the left, made of a body + a raised
// center cap. Cylinder070, alone on the other side, was the wrong guess (the
// "small oval button on the right") and is no longer part of this at all.
const COMPUTER_POWER_BUTTON_NODES = ['Cylinder068', 'Cylinder069'];
const COMPUTER_SCREEN_NODE = 'COMPUTER_3006'; // just used to aim the zoom-in
const COMPUTER_BUTTON_HITBOX_RADIUS = 0.4; // generous invisible sphere so a near-miss still registers

let computerPowerButtonParts = [];

/** Invisible, generously-sized sphere so tiny prop geometry is still easy to click. */
function addClickHitbox(targetObject, radius, worldPositionOverride) {
  const hitbox = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 10, 10),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  );
  if (worldPositionOverride) {
    hitbox.position.copy(worldPositionOverride);
  } else {
    targetObject.getWorldPosition(hitbox.position);
  }
  // Flags this as a placed hitbox (as opposed to a raw mesh also registered
  // as clickable) — see findScreenSpaceHoverTarget, which only trusts these
  // for its cursor-proximity assist since their position is deliberately
  // placed at the object's visual center, not just the mesh's raw origin
  // (which for something like the mailbox sits down at the post's base).
  hitbox.userData.isClickHitbox = true;
  scene.add(hitbox);
  return hitbox;
}

function setupComputerTerminal(root) {
  computerPowerButtonParts = COMPUTER_POWER_BUTTON_NODES.map((nodeName) =>
    resolveNamedChild(root, 'Computer', nodeName, 'setupComputerTerminal')
  ).filter(Boolean);
  if (computerPowerButtonParts.length === 0) return;

  computerScreenMaterials = [];
  for (const part of computerPowerButtonParts) {
    const mat = Array.isArray(part.material) ? part.material[0] : part.material;
    if (mat && (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) {
      mat.emissive = COMPUTER_GLOW_COLOR.clone();
      mat.emissiveIntensity = 0;
      mat.toneMapped = false; // same trick as the ceiling wireframe — reads as an actual glow, not a dim tint
      computerScreenMaterials.push(mat);
    }
    part.userData.onActivate = () => openComputerModal();
    clickableSceneObjects.push(part);
  }
  if (computerScreenMaterials.length === 0) {
    console.warn('Computer power button material is not standard/physical — skipping glow, click still works.');
  }

  // Extra invisible hitbox centered on the button pair, on top of the raw
  // meshes above — these are small props and easy to miss by a few pixels.
  const hitbox = addClickHitbox(computerPowerButtonParts[0], COMPUTER_BUTTON_HITBOX_RADIUS);
  hitbox.userData.onActivate = () => openComputerModal();
  clickableSceneObjects.push(hitbox);

  // Screen mesh is only used to aim the zoom-in at something screen-shaped
  // rather than the button itself; falls back to the button's own position.
  computerScreenObject = resolveNamedChild(root, 'Computer', COMPUTER_SCREEN_NODE, 'setupComputerTerminal');

  buildComputerModal();
}

function updateComputerGlow(deltaSeconds) {
  if (computerScreenMaterials.length === 0) return;
  computerBlinkClock += deltaSeconds;
  // Slow breathing pulse between dim and bright; steadier (brighter floor) once "on".
  const pulse = (Math.sin(computerBlinkClock * Math.PI * 2 * COMPUTER_BLINK_HZ) + 1) / 2;
  const floor = computerOn ? 1.2 : 0.4;
  const ceiling = computerOn ? 2.4 : 1.6;
  const intensity = floor + pulse * (ceiling - floor);
  for (const mat of computerScreenMaterials) {
    mat.emissiveIntensity = intensity;
  }
}
// ---------------------------------------------------------------------------

// --- Ceiling wireframe glow + the eye/brain that watches the player ---------
// The wireframe material already carries a green emissive color from Blender,
// but glTF's plain emissiveFactor is clamped to [0,1] with no extra punch, so
// it was rendering as barely-lit thin lines. Boost it well past that ceiling
// and skip tone mapping on it so it reads as an actual glow.
const CEILING_GLOW_INTENSITY = 12;

function setupCeilingGlow(root) {
  const wireMesh = resolveNamedChild(root, 'CeilingWireframe', 'wireframe_room001', 'setupCeilingGlow');
  if (!wireMesh) return;
  const mat = Array.isArray(wireMesh.material) ? wireMesh.material[0] : wireMesh.material;
  if (!mat) return;
  mat.emissiveIntensity = CEILING_GLOW_INTENSITY;
  mat.toneMapped = false; // keep the neon-green punchy instead of ACES-compressing it
  mat.needsUpdate = true;
}

// Confirmed via glb inspection: both the eye ('eye.002' -> mesh 'Sphere.114')
// and the brain ('Brain 2.002' -> mesh 'Roundcube.001') carry a flat white
// material with no baseColorTexture at all — there's no baked art to fall
// back on, so these are generated procedurally on a canvas instead.
function buildEyeCanvasTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;

  // Sclera
  ctx.fillStyle = '#f4ece0';
  ctx.fillRect(0, 0, size, size);
  const scleraShade = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, size * 0.5);
  scleraShade.addColorStop(0, 'rgba(255,255,255,0)');
  scleraShade.addColorStop(1, 'rgba(120,90,90,0.35)');
  ctx.fillStyle = scleraShade;
  ctx.fillRect(0, 0, size, size);

  // Bloodshot veins
  ctx.strokeStyle = 'rgba(200,40,60,0.35)';
  for (let i = 0; i < 26; i++) {
    const angle = Math.random() * Math.PI * 2;
    const startR = size * (0.32 + Math.random() * 0.06);
    const endR = size * (0.48 + Math.random() * 0.06);
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * startR, cy + Math.sin(angle) * startR);
    const midAngle = angle + (Math.random() - 0.5) * 0.4;
    ctx.quadraticCurveTo(
      cx + Math.cos(midAngle) * (startR + endR) * 0.55,
      cy + Math.sin(midAngle) * (startR + endR) * 0.55,
      cx + Math.cos(angle) * endR,
      cy + Math.sin(angle) * endR
    );
    ctx.stroke();
  }

  // Iris — neon ring matching the site's cyan/magenta palette
  const irisR = size * 0.27;
  const iris = ctx.createRadialGradient(cx, cy, irisR * 0.15, cx, cy, irisR);
  iris.addColorStop(0, '#35ffcf');
  iris.addColorStop(0.55, '#1fa8ff');
  iris.addColorStop(1, '#9d2bff');
  ctx.fillStyle = iris;
  ctx.beginPath();
  ctx.arc(cx, cy, irisR, 0, Math.PI * 2);
  ctx.fill();

  // Iris striations
  ctx.strokeStyle = 'rgba(5,10,15,0.35)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 48; i++) {
    const angle = (i / 48) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * irisR * 0.2, cy + Math.sin(angle) * irisR * 0.2);
    ctx.lineTo(cx + Math.cos(angle) * irisR * 0.98, cy + Math.sin(angle) * irisR * 0.98);
    ctx.stroke();
  }

  // Pupil
  ctx.fillStyle = '#050505';
  ctx.beginPath();
  ctx.arc(cx, cy, irisR * 0.42, 0, Math.PI * 2);
  ctx.fill();

  // Glint
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - irisR * 0.28, cy - irisR * 0.32, irisR * 0.12, irisR * 0.08, -0.5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function buildBrainCanvasTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#e8a8ab';
  ctx.fillRect(0, 0, size, size);

  // Mottled shading
  for (let i = 0; i < 140; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 12 + Math.random() * 30;
    const shade = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = Math.random() > 0.5 ? 'rgba(200,90,100,0.18)' : 'rgba(255,200,205,0.18)';
    shade.addColorStop(0, tone);
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Wrinkle lines (sulci) — wavy bezier strokes across the surface
  ctx.strokeStyle = 'rgba(150,50,60,0.55)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 22; i++) {
    const startX = Math.random() * size;
    const startY = Math.random() * size;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    let x = startX;
    let y = startY;
    for (let seg = 0; seg < 4; seg++) {
      const cx1 = x + (Math.random() - 0.5) * 90;
      const cy1 = y + (Math.random() - 0.5) * 90;
      x += (Math.random() - 0.5) * 120;
      y += (Math.random() - 0.5) * 120;
      ctx.quadraticCurveTo(cx1, cy1, x, y);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Eye + brain were already art-directed to sit at the same point in Blender —
// they just weren't both surviving the prune (see PRUNE_TOKENS.GiantEye above).
// Rotating both to face the camera each frame reads as one combined prop since
// they already share a pivot.
let ceilingEyeParts = [];

function setupCeilingEye(root) {
  const eyePart = resolveNamedChild(root, 'GiantEye', 'eye002', 'setupCeilingEye');
  const brainPart = resolveNamedChild(root, 'GiantEye', 'Brain_2002', 'setupCeilingEye');

  if (eyePart) {
    const mat = (Array.isArray(eyePart.material) ? eyePart.material[0] : eyePart.material)?.clone();
    if (mat) {
      mat.map = buildEyeCanvasTexture();
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      eyePart.material = mat;
    }
  }
  if (brainPart) {
    const mat = (Array.isArray(brainPart.material) ? brainPart.material[0] : brainPart.material)?.clone();
    if (mat) {
      mat.map = buildBrainCanvasTexture();
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
      brainPart.material = mat;
    }
  }

  ceilingEyeParts = [eyePart, brainPart].filter(Boolean);
}

// If the eye still doesn't visibly track (or tracks facing the wrong way —
// sideways/away from you instead of toward you), it's this one number: -Z is
// Three.js's default "forward" for lookAt(), which may not match the way the
// eyeball's pupil texture was actually modeled/UV'd. Try Math.PI (180°) first
// (the most common mismatch — the mesh modeled "backward"), then ±Math.PI/2.
const CEILING_EYE_FACING_OFFSET = 0;

/**
 * There used to be a second, older eye-tracking system here (a global
 * "first mesh anywhere in the whole museum whose name contains 'eye'"
 * search) that's been removed — it was silently locking onto one of the
 * NPC fairies' own tiny face meshes instead of this one, since several
 * character exports also happen to have a node literally named "eye" and
 * loaded earlier in the model list. This is now the only eye-tracking code,
 * correctly scoped to the actual ceiling GiantEye asset.
 */
function updateCeilingEye() {
  for (const part of ceilingEyeParts) {
    part.lookAt(camera.position);
    if (CEILING_EYE_FACING_OFFSET) part.rotateY(CEILING_EYE_FACING_OFFSET);
  }
}
// ---------------------------------------------------------------------------

// --- Settings: gear icon opens a master/music volume panel -----------------
let settingsMasterVolume = 1;
let settingsMusicVolume = 1;
let settingsModalEl = null;

function getEffectiveMusicVolume() {
  return settingsMasterVolume * settingsMusicVolume;
}

/** Pushes the current sliders onto whatever's playing right now. Floor music
 * reads getEffectiveMusicVolume() directly every frame during its fade
 * state machine, so it doesn't need a push here — only the player does,
 * since its volume is otherwise only set once per track. */
function applyVolumeSettings() {
  if (musicPlayerAudio) {
    musicPlayerAudio.volume = MUSIC_PLAYER_VOLUME * getEffectiveMusicVolume();
  }
}

function buildSettingsModal() {
  settingsModalEl = document.createElement('div');
  Object.assign(settingsModalEl.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '30',
  });

  const panel = document.createElement('div');
  Object.assign(panel.style, {
    width: '320px',
    padding: '20px',
    background: '#050806',
    border: '2px solid #35ffcf',
    borderRadius: '6px',
    boxShadow: '0 0 24px rgba(53,255,207,0.35)',
    fontFamily: 'monospace',
    color: '#35ffcf',
  });

  const title = document.createElement('div');
  title.textContent = 'SETTINGS';
  title.style.marginBottom = '14px';
  title.style.fontWeight = 'bold';
  panel.appendChild(title);

  const addSlider = (label, initial, onChange) => {
    const row = document.createElement('div');
    row.style.marginBottom = '16px';
    const labelEl = document.createElement('div');
    labelEl.textContent = `${label}: ${Math.round(initial * 100)}%`;
    labelEl.style.fontSize = '12px';
    labelEl.style.marginBottom = '6px';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = String(Math.round(initial * 100));
    slider.style.width = '100%';
    slider.addEventListener('input', () => {
      const v = Number(slider.value) / 100;
      labelEl.textContent = `${label}: ${Math.round(v * 100)}%`;
      onChange(v);
    });
    row.appendChild(labelEl);
    row.appendChild(slider);
    panel.appendChild(row);
  };

  addSlider('MASTER VOLUME', settingsMasterVolume, (v) => {
    settingsMasterVolume = v;
    applyVolumeSettings();
  });
  addSlider('MUSIC VOLUME', settingsMusicVolume, (v) => {
    settingsMusicVolume = v;
    applyVolumeSettings();
  });

  const closeButton = document.createElement('button');
  closeButton.textContent = 'CLOSE';
  Object.assign(closeButton.style, {
    width: '100%',
    padding: '8px',
    marginTop: '4px',
    background: 'transparent',
    border: '1px solid #35ffcf',
    color: '#35ffcf',
    fontFamily: 'monospace',
    cursor: 'pointer',
  });
  closeButton.addEventListener('click', closeSettingsModal);
  panel.appendChild(closeButton);

  settingsModalEl.appendChild(panel);
  document.body.appendChild(settingsModalEl);
}

function openSettingsModal() {
  uiModalOpen = true;
  activeModalCloser = closeSettingsModal;
  settingsModalEl.style.display = 'flex';
}

function closeSettingsModal() {
  settingsModalEl.style.display = 'none';
  uiModalOpen = false;
  activeModalCloser = null;
}

const SETTINGS_GEAR_HITBOX_RADIUS = 0.45;

function setupSettingsGear(root) {
  const gear = resolveNamedChild(root, 'InfoDeskHelpGear', 'Gear003', 'setupSettingsGear');
  if (!gear) return;

  gear.userData.onActivate = () => openSettingsModal();
  clickableSceneObjects.push(gear);
  const hb = addClickHitbox(gear, SETTINGS_GEAR_HITBOX_RADIUS);
  hb.userData.onActivate = gear.userData.onActivate;
  clickableSceneObjects.push(hb);

  buildSettingsModal();
}
// ---------------------------------------------------------------------------

// --- Mailbox: click opens a note-writing modal, sends via EmailJS to
// rngwip@gmail.com. The box exported as ONE rigid mesh (no separate hinged
// front panel), so there's no door-swing animation here — the note UI
// opening IS the "the mailbox is open" cue. The flag is a genuinely separate
// part, though, and does physically flip up after a note sends.
//
// SETUP NEEDED: create a free account at https://www.emailjs.com, add an
// Email Service pointed at (or forwarding to) rngwip@gmail.com, add a
// Template with params {{from_note}} and {{sent_at}}, then paste your
// Service ID / Template ID / Public Key into the three constants below. The
// UI works right now regardless — it just shows a "not configured yet"
// message on send until those are filled in.
const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
const MAILBOX_RECIPIENT = 'rngwip@gmail.com';
const MAILBOX_INTERACT_DISTANCE = 10;

let mailboxModalEl = null;
let mailboxPanelEl = null;
let mailboxTextarea = null;
let mailboxStatusEl = null;
let mailboxFlagState = null; // { object, closedRotX, isUp }

function buildMailboxModal() {
  mailboxModalEl = document.createElement('div');
  Object.assign(mailboxModalEl.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.6)',
    zIndex: '30',
    perspective: '700px', // lets the panel's hinge-fold below render as real 3D, not a flat squash
  });

  // Note: Mailbox.glb only has 3 nodes (body + flag + flag pivot) — there's
  // no separate hinged "front panel" mesh to animate in 3D. Standing in with
  // a CSS hinge-fold on the note panel itself (rotates down from its top
  // edge, like a flap opening) before the note UI becomes usable — gets the
  // "panel folds down, then the popup appears" feel without a re-export.
  mailboxPanelEl = document.createElement('div');
  Object.assign(mailboxPanelEl.style, {
    width: '360px',
    padding: '20px',
    background: '#050806',
    border: '2px solid #35ffcf',
    borderRadius: '6px',
    boxShadow: '0 0 24px rgba(53,255,207,0.35)',
    fontFamily: 'monospace',
    color: '#35ffcf',
    transformOrigin: 'top center',
    transform: 'rotateX(-100deg)',
    opacity: '0',
    transition: 'transform 0.38s cubic-bezier(0.2, 0.7, 0.3, 1), opacity 0.28s ease',
  });
  const panel = mailboxPanelEl;

  const title = document.createElement('div');
  title.textContent = 'LEAVE A NOTE IN THE MAILBOX';
  title.style.marginBottom = '10px';
  title.style.fontWeight = 'bold';

  mailboxTextarea = document.createElement('textarea');
  mailboxTextarea.placeholder = 'write something...';
  mailboxTextarea.rows = 6;
  Object.assign(mailboxTextarea.style, {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px',
    background: '#0a120f',
    border: '1px solid #35ffcf',
    color: '#35ffcf',
    fontFamily: 'monospace',
    fontSize: '13px',
    outline: 'none',
    marginBottom: '10px',
    resize: 'vertical',
  });
  mailboxTextarea.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') closeMailboxModal();
  });

  const buttonRow = document.createElement('div');
  buttonRow.style.display = 'flex';
  buttonRow.style.gap = '8px';

  const sendButton = document.createElement('button');
  sendButton.textContent = 'SEND';
  const closeButton = document.createElement('button');
  closeButton.textContent = 'CLOSE';
  for (const btn of [sendButton, closeButton]) {
    Object.assign(btn.style, {
      flex: '1',
      padding: '8px',
      background: 'transparent',
      border: '1px solid #35ffcf',
      color: '#35ffcf',
      fontFamily: 'monospace',
      cursor: 'pointer',
    });
  }
  sendButton.addEventListener('click', attemptSendMailboxNote);
  closeButton.addEventListener('click', closeMailboxModal);
  buttonRow.appendChild(sendButton);
  buttonRow.appendChild(closeButton);

  mailboxStatusEl = document.createElement('div');
  Object.assign(mailboxStatusEl.style, { marginTop: '10px', fontSize: '12px', minHeight: '14px' });

  panel.appendChild(title);
  panel.appendChild(mailboxTextarea);
  panel.appendChild(buttonRow);
  panel.appendChild(mailboxStatusEl);
  mailboxModalEl.appendChild(panel);
  document.body.appendChild(mailboxModalEl);
}

function openMailboxModal() {
  uiModalOpen = true;
  activeModalCloser = closeMailboxModal;
  mailboxModalEl.style.display = 'flex';
  mailboxStatusEl.textContent = '';
  // Start folded shut, then fold down into place — the textarea only
  // becomes focusable once the fold finishes, so it reads as "opens, then
  // you can write" rather than everything just appearing at once.
  mailboxPanelEl.style.transform = 'rotateX(-100deg)';
  mailboxPanelEl.style.opacity = '0';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      mailboxPanelEl.style.transform = 'rotateX(0deg)';
      mailboxPanelEl.style.opacity = '1';
    });
  });
  window.setTimeout(() => mailboxTextarea.focus(), 380);
}

function closeMailboxModal() {
  mailboxPanelEl.style.transform = 'rotateX(-100deg)';
  mailboxPanelEl.style.opacity = '0';
  window.setTimeout(() => {
    mailboxModalEl.style.display = 'none';
  }, 220);
  uiModalOpen = false;
  activeModalCloser = null;
}

function attemptSendMailboxNote() {
  const text = mailboxTextarea.value.trim();
  if (!text) {
    mailboxStatusEl.style.color = '#ff5f6d';
    mailboxStatusEl.textContent = 'Write something first.';
    return;
  }
  if (typeof window.emailjs === 'undefined') {
    mailboxStatusEl.style.color = '#ff5f6d';
    mailboxStatusEl.textContent = "Mail service isn't wired up yet — ask the museum staff.";
    console.warn('[mailbox] window.emailjs is missing — check the EmailJS <script> tag in index.html.');
    return;
  }
  if (EMAILJS_SERVICE_ID.startsWith('YOUR_')) {
    mailboxStatusEl.style.color = '#ff5f6d';
    mailboxStatusEl.textContent = "Mail service isn't configured yet — ask the museum staff.";
    console.warn('[mailbox] EmailJS IDs are still placeholders — fill in EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY.');
    return;
  }

  mailboxStatusEl.style.color = '#35ffcf';
  mailboxStatusEl.textContent = 'Sending...';

  window.emailjs
    .send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      { from_note: text, sent_at: new Date().toLocaleString(), to_email: MAILBOX_RECIPIENT },
      { publicKey: EMAILJS_PUBLIC_KEY }
    )
    .then(() => {
      mailboxTextarea.value = '';
      closeMailboxModal();
      if (mailboxFlagState) mailboxFlagState.isUp = true;
    })
    .catch((err) => {
      mailboxStatusEl.style.color = '#ff5f6d';
      mailboxStatusEl.textContent = 'Send failed — try again in a moment.';
      console.error('[mailbox] EmailJS send failed:', err);
    });
}

function setupMailbox(root) {
  const mailboxBody = resolveNamedChild(root, 'Mailbox', 'Cube145', 'setupMailbox');
  if (!mailboxBody) return;

  // Cube145 is the whole mailbox (post + purple panel) as one merged mesh, so
  // its own node origin sits down at the post's base. That made both the raw
  // raycast target AND the click hitbox center low, near the pole, instead of
  // up at the visually obvious purple panel. Compute the real bounding box
  // and bias the click anchor up into the top ~70% of it (the panel), not the
  // mesh's raw origin.
  const mailboxBox = new THREE.Box3().setFromObject(mailboxBody);
  const mailboxSize = mailboxBox.getSize(new THREE.Vector3());
  const mailboxAnchor = mailboxBox.getCenter(new THREE.Vector3());
  mailboxAnchor.y = mailboxBox.min.y + mailboxSize.y * 0.7;

  mailboxBody.userData.onActivate = () => openMailboxModal();
  mailboxBody.userData.interactDistance = MAILBOX_INTERACT_DISTANCE;
  clickableSceneObjects.push(mailboxBody);
  const hb = addClickHitbox(mailboxBody, Math.max(mailboxSize.x, mailboxSize.z) * 0.55, mailboxAnchor);
  hb.userData.onActivate = mailboxBody.userData.onActivate;
  hb.userData.interactDistance = MAILBOX_INTERACT_DISTANCE;
  clickableSceneObjects.push(hb);

  // The flag — a separate node from the box, so it's genuinely animatable.
  // Axis/angle is a guess (no way to preview the export here); tell me if it
  // flips the wrong way or through the post and I'll adjust the one line.
  const flag = resolveNamedChild(root, 'Mailbox', 'Cylinder157', 'setupMailbox');
  if (flag) {
    mailboxFlagState = { object: flag, closedRotX: flag.rotation.x, isUp: false };
  }

  buildMailboxModal();
}

function updateMailboxFlag(deltaSeconds) {
  if (!mailboxFlagState) return;
  const targetRotX = mailboxFlagState.closedRotX + (mailboxFlagState.isUp ? -Math.PI * 0.4 : 0);
  mailboxFlagState.object.rotation.x = THREE.MathUtils.damp(
    mailboxFlagState.object.rotation.x,
    targetRotX,
    6,
    deltaSeconds
  );
}
// ---------------------------------------------------------------------------

// --- Venus flytraps: a breathing mouth-pulse (open/close) + glowing
// cigarette ember on the smoking one (VenusFlytrap2). No swaying — that's
// been removed per feedback (it read as swaying back and forth rather than
// biting).
//
// Checked both exports: VenusFlytrap1's whole head/pot is ONE rigid merged
// mesh (5 material slots, no separate movable jaw piece) — there's no piece
// to animate open/close here at all without a re-export that splits the
// mouth/jaw into its own object (same idea as the mailbox door: separate the
// jaw geometry, give it its own pivot at the hinge point, name it distinctly,
// re-export). VenusFlytrap2 does have two separate red "mouth" spheres
// already, so those get the pulsing scale animation as a stand-in for
// opening/closing — that one's fully working without any re-export needed.
const FLYTRAP_MOUTH_PULSE_HZ = 0.35;
const FLYTRAP_EMBER_COLOR = [0.8, 0.183, 0.0]; // matches 'Material.213' baseColorFactor on ciggy.001

let flytrapMouthTargets = []; // { object, baseScale, phase }
let flytrapEmberMaterial = null;
let flytrapClock = 0;

/** Finds a mesh by baked baseColor rather than by name — used for the ember
 * since its exact sanitized child name (inside the multi-primitive 'ciggy'
 * part) wasn't worth guessing when the color match is unambiguous. */
function findMeshByBaseColor(root, [r, g, b], tolerance = 0.08) {
  let found = null;
  root.traverse((child) => {
    if (found || !child.isMesh) return;
    const mat = Array.isArray(child.material) ? child.material[0] : child.material;
    if (!mat || !mat.color) return;
    if (
      Math.abs(mat.color.r - r) < tolerance &&
      Math.abs(mat.color.g - g) < tolerance &&
      Math.abs(mat.color.b - b) < tolerance
    ) {
      found = child;
    }
  });
  return found;
}

function setupVenusFlytraps(root) {
  const vf2 = root.getObjectByName('VenusFlytrap2');
  if (!vf2) return;

  vf2.traverse((child) => {
    if (!child.isMesh) return;
    const mat = Array.isArray(child.material) ? child.material[0] : child.material;
    // The two red "venus fly trap.002" spheres — the mouths.
    if (mat && mat.color && mat.color.r > 0.6 && mat.color.g > 0.03 && mat.color.g < 0.25 && mat.color.b < 0.3) {
      flytrapMouthTargets.push({ object: child, baseScale: child.scale.clone(), phase: Math.random() * Math.PI * 2 });
    }
  });

  const ember = findMeshByBaseColor(vf2, FLYTRAP_EMBER_COLOR);
  if (ember) {
    const mat = (Array.isArray(ember.material) ? ember.material[0] : ember.material)?.clone();
    if (mat) {
      mat.emissive = new THREE.Color(0xff5a1a);
      mat.emissiveIntensity = 0;
      mat.toneMapped = false;
      mat.needsUpdate = true;
      ember.material = mat;
      flytrapEmberMaterial = mat;
    }
  } else {
    console.warn('[setupVenusFlytraps] Could not find the cigarette ember mesh by color match.');
  }
}

function updateVenusFlytraps(deltaSeconds) {
  if (flytrapMouthTargets.length === 0 && !flytrapEmberMaterial) return;
  flytrapClock += deltaSeconds;

  for (const target of flytrapMouthTargets) {
    const t = (Math.sin(flytrapClock * Math.PI * 2 * FLYTRAP_MOUTH_PULSE_HZ + target.phase) + 1) / 2;
    const s = 0.75 + t * 0.5; // 75%–125% of the baked scale
    target.object.scale.set(target.baseScale.x * s, target.baseScale.y * s, target.baseScale.z * s);
  }

  if (flytrapEmberMaterial) {
    const pulse = (Math.sin(flytrapClock * Math.PI * 2 * 0.8) + 1) / 2;
    flytrapEmberMaterial.emissiveIntensity = 0.6 + pulse * 1.4;
  }
}
// ---------------------------------------------------------------------------

let scene;
let camera;
let renderer;
let controls;
let clock;
let museumRoot = null;
let productBlocks = [];
let pmremGenerator = null;
let roomEnvironment = null;
const animationMixers = [];
// Turned off as a trial per your "what happens if we remove collision"
// question — with this false, the player simply walks through every wall,
// door, and prop (no blocking at all). Note this does NOT affect the floor:
// there's no real floor raycasting anywhere in this codebase — vertical
// position is just a fixed eye-height constant set at spawn/teleport — so
// turning collision off can't cause falling through the ground, only losing
// the wall-blocking. If it feels better this way, it can stay off; if you'd
// rather have walls block movement again while I keep digging into the
// glitchiness, flip this back to true (there was also a real bug fixed
// alongside this — see the ROOM_ASSETS 'MedievalLayerrr' typo note below —
// so it may already behave better than what you tested last).
const COLLISION_ENABLED = false;
// Only these assets' meshes are ever considered for collision — the other
// ~75 loaded assets (TVs, picture frames, bathroom fixtures, plants, etc.)
// are furniture/decor and were never worth raycasting against anyway.
const COLLISION_ASSET_ALLOWLIST = new Set([
  'EntryRoom',
  'EntryRoomDoorLeft',
  'EntryRoomDoorRight',
  'MainRoom',
  'Backrooms',
  'MedievalLayer',
  'GiftShopRoom',
  'Bathroom',
  'BathroomStallWalls',
]);
// Master list of every collidable mesh in the museum (built once at load).
const collisionMeshes = [];
// Broad-phase subset of collisionMeshes actually near the player — this, not
// collisionMeshes, is what movement raycasts against each frame. Recomputed
// on a timer (see updateCollisionBroadPhase), not every frame.
let activeCollisionMeshes = [];
const COLLISION_QUERY_RADIUS = 18; // meters — geometry farther than this is skipped entirely
const COLLISION_REFRESH_INTERVAL = 0.2; // seconds between broad-phase refreshes
let collisionRefreshTimer = 0;
const collisionRaycaster = new THREE.Raycaster();
const _collisionOrigin = new THREE.Vector3();
const _collisionMove = new THREE.Vector3();
const _collisionDir = new THREE.Vector3();
const PLAYER_RADIUS = 0.45;
// Sample points below the eye — covers legs through upper chest (hits desks ~waist height).
// Kept to 3 (was 6): halves the raycasts thrown every movement frame.
const COLLISION_BODY_OFFSETS = [0, 0.7, 1.4];
let lookTarget = new THREE.Vector3();
const CAMERA_FORWARD = new THREE.Vector3(0, 0, -1);
const WORLD_UP = new THREE.Vector3(0, 1, 0);

const keyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  rotateLeft: false,
  rotateRight: false,
};

const moveSpeed = 7.5;
const keyTurnSpeed = 2.2;
const lookSensitivity = 0.0022;
const touchLookSensitivity = 0.0032;
const maxPitch = Math.PI / 2 - 0.05;
const USE_TOUCH_CONTROLS =
  window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
const TAP_MOVE_PX = 14;
const TAP_MAX_MS = 350;
let lookTouch = null;
let stickOrigin = null;
let stickKnobEl = null;
const gravity = 15;
const jumpVelocityStart = 6.5;
const maxJumps = 3;
let yaw = Math.PI;
let pitch = 0;
let baseEyeHeight = 0;
let verticalVelocity = 0;
let jumpsRemaining = 0;
let isAirborne = false;

const mouse = new THREE.Vector2();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );
  camera.position.set(-5, -5, 15);

  renderer = new THREE.WebGLRenderer({ antialias: !USE_TOUCH_CONTROLS });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, USE_TOUCH_CONTROLS ? 1.25 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // ACES ≈ Blender Filmic / AgX view transform for PBR materials.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = false;

  setupBlenderStyleLighting();

  window.addEventListener('resize', onWindowResize);
  window.visualViewport?.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  if (USE_TOUCH_CONTROLS) {
    setupMobileControls();
  } else {
    window.addEventListener('click', onTvScreenClick);
    window.addEventListener('click', onSceneClick);
  }

  setupFloorMusic();
  loadAllModels();
}

function setupMobileControls() {
  const hud = document.createElement('div');
  hud.id = 'mobile-hud';

  const stick = document.createElement('div');
  stick.id = 'mobile-stick';
  stickKnobEl = document.createElement('div');
  stickKnobEl.id = 'mobile-stick-knob';
  stick.appendChild(stickKnobEl);

  const jump = document.createElement('button');
  jump.id = 'mobile-jump';
  jump.type = 'button';
  jump.textContent = 'JUMP';

  const hint = document.createElement('div');
  hint.id = 'mobile-hint';
  hint.textContent = 'stick to walk · drag to look · tap to use';

  hud.appendChild(stick);
  hud.appendChild(jump);
  hud.appendChild(hint);
  document.body.appendChild(hud);

  window.setTimeout(() => {
    hint.style.opacity = '0';
  }, 5000);

  stick.addEventListener('pointerdown', (event) => {
    if (uiModalOpen) return;
    event.preventDefault();
    stick.setPointerCapture(event.pointerId);
    const rect = stick.getBoundingClientRect();
    stickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, id: event.pointerId };
    updateJoystickFromPointer(event.clientX, event.clientY);
  });
  stick.addEventListener('pointermove', (event) => {
    if (!stickOrigin || event.pointerId !== stickOrigin.id) return;
    event.preventDefault();
    updateJoystickFromPointer(event.clientX, event.clientY);
  });
  const endStick = (event) => {
    if (!stickOrigin || event.pointerId !== stickOrigin.id) return;
    stickOrigin = null;
    keyState.forward = false;
    keyState.backward = false;
    keyState.left = false;
    keyState.right = false;
    if (stickKnobEl) stickKnobEl.style.transform = '';
  };
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  jump.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!uiModalOpen) tryJump();
  });

  window.addEventListener('pointerdown', onTouchLookDown);
  window.addEventListener('pointermove', onTouchLookMove);
  window.addEventListener('pointerup', onTouchLookUp);
  window.addEventListener('pointercancel', onTouchLookUp);
}

function updateJoystickFromPointer(clientX, clientY) {
  if (!stickOrigin || !stickKnobEl) return;
  const dx = clientX - stickOrigin.x;
  const dy = clientY - stickOrigin.y;
  const maxR = 48;
  const len = Math.hypot(dx, dy) || 1;
  const scale = Math.min(len, maxR) / len;
  const nx = dx * scale;
  const ny = dy * scale;
  stickKnobEl.style.transform = `translate(${nx}px, ${ny}px)`;
  const dead = 14;
  keyState.forward = ny < -dead;
  keyState.backward = ny > dead;
  keyState.left = nx < -dead;
  keyState.right = nx > dead;
}

function isHudPointerTarget(target) {
  if (!target || typeof target.closest !== 'function') return false;
  if (target.closest('#mobile-hud')) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A';
}

function onTouchLookDown(event) {
  if (uiModalOpen || lookTouch || isHudPointerTarget(event.target)) return;
  if (event.pointerType === 'mouse') return;
  lookTouch = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    startTime: performance.now(),
    dragged: false,
  };
}

function onTouchLookMove(event) {
  if (!lookTouch || event.pointerId !== lookTouch.id || uiModalOpen) return;
  const dx = event.clientX - lookTouch.x;
  const dy = event.clientY - lookTouch.y;
  const total = Math.hypot(event.clientX - lookTouch.startX, event.clientY - lookTouch.startY);
  if (!lookTouch.dragged && total > TAP_MOVE_PX) lookTouch.dragged = true;
  lookTouch.x = event.clientX;
  lookTouch.y = event.clientY;
  if (!lookTouch.dragged) return;
  yaw -= dx * touchLookSensitivity;
  pitch -= dy * touchLookSensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);
}

function onTouchLookUp(event) {
  if (!lookTouch || event.pointerId !== lookTouch.id) return;
  const dt = performance.now() - lookTouch.startTime;
  const dist = Math.hypot(event.clientX - lookTouch.startX, event.clientY - lookTouch.startY);
  const wasTap = !lookTouch.dragged && dist <= TAP_MOVE_PX && dt <= TAP_MAX_MS;
  lookTouch = null;
  if (!wasTap || uiModalOpen) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  updateTvScreenHover();
  updateSceneHover();
  onTvScreenClick();
  onSceneClick();
}

function loadAllModels() {
  museumRoot = new THREE.Group();
  museumRoot.name = 'MuseumRoot';
  scene.add(museumRoot);

  const manager = new THREE.LoadingManager();
  manager.onLoad = () => {
    // Each step runs in isolation now — one broken step (bad node name, missing
    // asset, etc.) used to silently kill every step after it in this list since
    // they all ran in one unguarded synchronous block. Now a failure is logged
    // with exactly which step broke, and the rest still run.
    const steps = [
      ['frameCameraFromEntryRoom', () => frameCameraFromEntryRoom(museumRoot)],
      ['collectInteractiveMeshes', () => collectInteractiveMeshes(museumRoot)],
      ['applyEnvironmentToMaterials', () => applyEnvironmentToMaterials(museumRoot)],
      ['collectCollisionMeshes', () => collectCollisionMeshes(museumRoot)],
      ['applyRandomTvVideos', () => applyRandomTvVideos(museumRoot)],
      ['setupSwingDoors', () => setupSwingDoors(museumRoot)],
      ['setupSlidingDoors', () => setupSlidingDoors(museumRoot)],
      ['setupToiletTeleport', () => setupToiletTeleport(museumRoot)],
      ['setupNpcDialogue', () => setupNpcDialogue(museumRoot)],
      ['setupComputerTerminal', () => setupComputerTerminal(museumRoot)],
      ['setupCeilingGlow', () => setupCeilingGlow(museumRoot)],
      ['setupCeilingEye', () => setupCeilingEye(museumRoot)],
      ['setupMusicPlayer', () => setupMusicPlayer(museumRoot)],
      ['setupIpodHorns', () => setupIpodHorns(museumRoot)],
      ['setupIpodScreen', () => setupIpodScreen(museumRoot)],
      ['setupSettingsGear', () => setupSettingsGear(museumRoot)],
      ['setupMailbox', () => setupMailbox(museumRoot)],
      ['setupVenusFlytraps', () => setupVenusFlytraps(museumRoot)],
    ];
    for (const [label, fn] of steps) {
      try {
        fn();
      } catch (err) {
        console.error(`[loadAllModels] "${label}" threw — everything after it still ran:`, err);
      }
    }
    console.log('All museum models loaded.');
  };
  manager.onError = (url) => {
    console.error('Failed to load:', url);
  };

  const loader = new GLTFLoader(manager);
  loader.setPath(ASSET_BASE);

  for (const file of MODEL_FILES) {
    loader.load(
      file,
      (gltf) => {
        const assetName = file.replace(/\.glb$/i, '');
        const model = gltf.scene;
        model.name = assetName;
        pruneSceneBleed(model, assetName);
        normalizeLoadedMaterials(model);
        fixProceduralMaterials(model);
        setupModelAnimations(model, gltf, assetName);
        museumRoot.add(model);
      },
      undefined,
      (err) => {
        console.error(`Error loading ${file}:`, err);
      }
    );
  }
}

// Full-scene GLBs (do not prune — these are intentional room exports).
const ROOM_ASSETS = new Set([
  // NOTE: this used to say 'MedievalLayerrr' (typo, extra r) which never
  // matched the real loaded asset name 'MedievalLayer' — so pruneSceneBleed
  // ran on it like any other prop and hid every mesh whose name didn't
  // literally contain "medieval"/"layer", which also silently deleted those
  // meshes from collision (collectCollisionMeshes skips invisible meshes).
  // That's the most likely cause of the persistent main-floor collision
  // glitchiness — real holes in the floor/wall geometry, not a raycast bug.
  // GiftShopRoom had the same problem (missing from this list entirely,
  // despite being in COLLISION_ASSET_ALLOWLIST) — added below.
  'MedievalLayer',
  'EntryRoom',
  'EntryRoomDoorRight',
  'EntryRoomDoorLeft',
  'EntryRoomLights',
  'MainRoom',
  'MainRoomPillars',
  'CeilingWireframe',
  'Backrooms',
  'GiftShopRoom',
  'Bathroom',
  'BathroomLights',
  'BathroomStallWalls',
  'VendingMachineRoot',
  'MusicPlaybar',
]);

const PRUNE_TOKENS = {
  BathroomDoor: ['door', 'grate'],
  // The brain mesh ('Brain_2002' live) sits co-located with the eye already — it
  // just didn't contain "eye" so it was being pruned out along with the rest
  // of the scene bleed. They were already art-directed to overlap; no new
  // geometry needed.
  GiantEye: ['eye', 'brain'],
  BathroomStallDoor1: ['door', 'stall'],
  BathroomStallDoor2: ['door', 'stall'],
  BathroomStallDoor3: ['door', 'stall'],
  GiftShopSprite: ['sprite', 'gift', 'icosphere', 'fairy', 'wing'],
  GiftShopRoom: ['gift shop room'],
  GiftShopDesk: ['gift shop desk', 'desk', 'cube.125', 'cube.126'],
  InfoDesk: ['info desk', 'desk', 'cube.125', 'cube.126'],
  BathroomSprite: ['sprite', 'bath', 'icosphere', 'fairy', 'wing'],
  Tina: ['tina', 'skrrt', 'jacket', 'wing', 'collar', 'hands'],
  // These three exported with generic Blender names (Cube.142, Torus.008, etc.) that
  // don't contain "toilet", so the default token derivation matched nothing and the
  // prune fallback was showing all 42 scene-bled meshes per file. Exact names instead.
  // Tokens are matched against GLTFLoader's sanitized live names (dots
  // stripped, spaces -> underscores), so these are written in that form even
  // though the source Blender names had dots (Cube.143 -> cube143, etc.).
  Toilet1: ['cube143', 'cylinder073', 'cylinder076', 'nurbspath030', 'nurbspath031', 'sphere086', 'sphere087', 'torus008'],
  Toilet2: ['cube142', 'cylinder074', 'cylinder075', 'nurbspath033', 'nurbspath034', 'sphere088', 'sphere089', 'torus009'],
  Toilet3: ['cube144', 'cylinder071', 'cylinder072', 'nurbspath029', 'nurbspath032', 'sphere084', 'sphere085', 'torus007'],
  // Same issue: the monitor's base/stand and a few detail meshes don't contain
  // "computer" so they were being pruned out along with the real scene bleed.
  Computer: ['computer', 'base004', 'cube198', 'cylinder068', 'cylinder069', 'cylinder070'],
  // Default token "ipod" matched BOTH the real back-room iPod (iPod.001, etc.)
  // AND the plain 'iPod' scene-bleed duplicate that's baked into every export
  // at the same fixed spot — so a second, stray iPod was rendering nowhere
  // near the real one. Exact suffixed names isolate just the real one.
  Ipod: ['ipod001', 'ipod_screen002', 'middle_button002', 'scroll_wheel002'],
  // Default tokens were "music"/"playbar" (split from the filename) but the
  // real mesh is named "PLAY BAR.001" — with a space (now an underscore in
  // the sanitized live name), so "playbar" never matched anything and
  // pruning fell back to showing all the boilerplate.
  MusicPlaybar: ['play_bar001'],
};

let checkerTexture = null;

function countMeshes(root) {
  let count = 0;
  root.traverse((child) => {
    if (child.isMesh) count++;
  });
  return count;
}

function getPruneTokens(assetName) {
  if (PRUNE_TOKENS[assetName]) return PRUNE_TOKENS[assetName];
  return assetName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter((token) => token.length > 2);
}

/**
 * Many prop exports accidentally include the entire Blender scene.
 * Hide meshes that do not match the asset name (e.g. BathroomDoor keeping only door meshes).
 */
function pruneSceneBleed(root, assetName) {
  if (ROOM_ASSETS.has(assetName)) return;

  const meshCount = countMeshes(root);
  if (meshCount <= 12) return;

  const tokens = getPruneTokens(assetName);
  let kept = 0;

  root.traverse((child) => {
    if (!child.isMesh) return;

    const names = [];
    let node = child;
    while (node && node !== root) {
      if (node.name) names.push(node.name.toLowerCase());
      node = node.parent;
    }
    const haystack = names.join(' ');
    const keep = tokens.some((token) => haystack.includes(token));
    child.visible = keep;
    if (keep) kept++;
  });

  if (kept === 0) {
    root.traverse((child) => {
      if (child.isMesh) child.visible = true;
    });
    console.warn(`Prune skipped for ${assetName}: no token matches; showing all meshes.`);
  } else {
    console.log(`Pruned ${assetName}: kept ${kept}/${meshCount} meshes.`);
  }
}

/**
 * Blender procedural nodes (Checker Texture, etc.) do not export to glTF unless baked.
 * If a material is named like "checkers" but has no map, apply a checker image fallback.
 */
function getCheckerTexture() {
  if (checkerTexture) return checkerTexture;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cells = 8;
  const cell = size / cells;

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#dddddd' : '#888888';
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }

  checkerTexture = new THREE.CanvasTexture(canvas);
  checkerTexture.colorSpace = THREE.SRGBColorSpace;
  checkerTexture.wrapS = THREE.RepeatWrapping;
  checkerTexture.wrapT = THREE.RepeatWrapping;
  checkerTexture.repeat.set(6, 6);
  checkerTexture.needsUpdate = true;
  return checkerTexture;
}

/**
 * Plays all glTF animation clips on loop (Blender actions export as separate clips).
 */
function setupModelAnimations(model, gltf, assetName) {
  const clips = gltf.animations;
  if (!clips?.length) return;

  const mixer = new THREE.AnimationMixer(model);

  for (const clip of clips) {
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.play();
  }

  animationMixers.push(mixer);
  console.log(`Animations: ${assetName} — ${clips.length} clip(s) looping`);
}

function updateAnimations(deltaSeconds) {
  for (const mixer of animationMixers) {
    mixer.update(deltaSeconds);
  }
}

function fixProceduralMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat?.name) continue;
      const name = mat.name.toLowerCase();
      if (!name.includes('checker') || mat.map) continue;

      mat.map = getCheckerTexture();
      mat.color.set(0xffffff);
      mat.metalness = 0;
      mat.roughness = 0.5;
      mat.needsUpdate = true;
    }
  });
}

/** Ensures color textures use sRGB; does not override material colors. */
function normalizeLoadedMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat) continue;

      for (const key of ['map', 'emissiveMap']) {
        const tex = mat[key];
        if (tex?.isTexture) {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.needsUpdate = true;
        }
      }

      if (mat.map) {
        mat.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }

      mat.needsUpdate = true;
    }
  });
}

/**
 * Blender-like lighting: IBL from a studio room (world/env) + soft key/fill/rim sun lamps.
 */
function setupBlenderStyleLighting() {
  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  roomEnvironment = new RoomEnvironment();
  const envMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
  scene.environment = envMap;
  roomEnvironment.dispose();
  roomEnvironment = null;

  // Low ambient — environment map carries most indirect light (like Blender world + bounces).
  scene.add(new THREE.AmbientLight(0xffffff, 0.2));

  const hemi = new THREE.HemisphereLight(0xe8eeff, 0x3d3835, 0.25);
  scene.add(hemi);

  // Key (main area / sun-style directional).
  const key = new THREE.DirectionalLight(0xfff4e0, 1.8);
  key.position.set(10, 18, 8);
  scene.add(key);

  // Fill (softer, cooler — opposite side).
  const fill = new THREE.DirectionalLight(0xc5d4ff, 0.55);
  fill.position.set(-8, 6, -6);
  scene.add(fill);

  // Rim / back light for shape separation.
  const rim = new THREE.DirectionalLight(0xffffff, 0.35);
  rim.position.set(0, 8, -12);
  scene.add(rim);
}

/** Tunes PBR materials to respond to scene.environment (glTF defaults can be too dark). */
function applyEnvironmentToMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh || !child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of materials) {
      if (!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) continue;
      mat.envMapIntensity = 1;
      mat.needsUpdate = true;
    }
  });
}

function frameCameraFromEntryRoom(root) {
  const entryRoomRoot = root.getObjectByName('EntryRoom') || root;
  const box = new THREE.Box3().setFromObject(entryRoomRoot);
  if (box.isEmpty()) {
    console.warn('Scene bounds are empty — check model paths and transforms.');
    return;
  }

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const farSpan = Math.max(size.x, size.y, size.z, 20);

  // Put camera at EntryRoom center and keep forward orientation on -Z.
  camera.position.copy(center);
  baseEyeHeight = center.y;
  verticalVelocity = 0;
  jumpsRemaining = maxJumps;
  isAirborne = false;
  yaw = Math.PI;
  pitch = 0;
  lookTarget.copy(center).add(CAMERA_FORWARD);
  camera.lookAt(lookTarget);

  camera.near = 0.05;
  camera.far = Math.max(2000, farSpan * 50);
  camera.updateProjectionMatrix();

  controls.target.copy(lookTarget);
  controls.minDistance = 0.1;
  controls.maxDistance = Math.max(150, farSpan * 10);
  controls.update();
}

function tryJump() {
  if (jumpsRemaining <= 0) return;
  verticalVelocity = jumpVelocityStart;
  jumpsRemaining--;
  isAirborne = true;
}

function collectInteractiveMeshes(root) {
  productBlocks = [];

  root.traverse((child) => {
    if (!child.isMesh) return;
    if (child.name.includes('ProductBlock')) {
      productBlocks.push(child);
    }
  });
}

function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  if (uiModalOpen || USE_TOUCH_CONTROLS) return; // don't spin the camera while a menu/modal has focus

  yaw -= event.movementX * lookSensitivity;
  pitch -= event.movementY * lookSensitivity;
  pitch = THREE.MathUtils.clamp(pitch, -maxPitch, maxPitch);
}

function onKeyDown(event) {
  if (uiModalOpen) {
    if (event.key === 'Escape') activeModalCloser?.();
    return; // let the modal's own input handle typing without also moving the player
  }
  const key = event.key.toLowerCase();
  if (key === ' ' || key.startsWith('arrow')) event.preventDefault();
  if (key === 'w' || key === 'arrowup') keyState.forward = true;
  if (key === 's' || key === 'arrowdown') keyState.backward = true;
  if (key === 'a' || key === 'arrowleft') keyState.left = true;
  if (key === 'd' || key === 'arrowright') keyState.right = true;
  if (key === 'q') keyState.rotateLeft = true;
  if (key === 'e') keyState.rotateRight = true;
  if (key === ' ' && !event.repeat) tryJump();
}

function onKeyUp(event) {
  if (uiModalOpen) return;
  const key = event.key.toLowerCase();
  if (key === ' ' || key.startsWith('arrow')) event.preventDefault();
  if (key === 'w' || key === 'arrowup') keyState.forward = false;
  if (key === 's' || key === 'arrowdown') keyState.backward = false;
  if (key === 'a' || key === 'arrowleft') keyState.left = false;
  if (key === 'd' || key === 'arrowright') keyState.right = false;
  if (key === 'q') keyState.rotateLeft = false;
  if (key === 'e') keyState.rotateRight = false;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

const COLLISION_DESK_ASSETS = new Set(['InfoDesk', 'GiftShopDesk', 'GiftShopRegister']);

const _meshBounds = new THREE.Box3();
const _meshSize = new THREE.Vector3();

function getAssetRootName(object) {
  let node = object;
  while (node.parent) {
    if (node.parent === museumRoot) return node.name;
    node = node.parent;
  }
  return '';
}

function collectCollisionMeshes(root) {
  collisionMeshes.length = 0;
  activeCollisionMeshes = [];
  if (!COLLISION_ENABLED) {
    console.log('Collision disabled for now (COLLISION_ENABLED = false).');
    return;
  }
  root.traverse((child) => {
    if (!child.isMesh || !child.visible) return;

    const asset = getAssetRootName(child);
    if (!COLLISION_ASSET_ALLOWLIST.has(asset)) return;

    if (COLLISION_DESK_ASSETS.has(asset)) {
      collisionMeshes.push(child);
      return;
    }

    _meshBounds.setFromObject(child);
    _meshBounds.getSize(_meshSize);
    const maxDim = Math.max(_meshSize.x, _meshSize.y, _meshSize.z);
    if (maxDim < 0.2) return;

    collisionMeshes.push(child);
  });

  // Precompute each mesh's world-space bounding sphere once, up front, so the
  // per-frame broad-phase filter below is just cheap distance checks — no
  // re-measuring geometry while the player is walking around.
  for (const mesh of collisionMeshes) {
    _meshBounds.setFromObject(mesh);
    const sphere = new THREE.Sphere();
    _meshBounds.getBoundingSphere(sphere);
    mesh.userData.collisionSphere = sphere;
  }

  museumRoot.updateMatrixWorld(true);
  refreshActiveCollisionMeshes();
  console.log(
    `Collision enabled on ${collisionMeshes.length} meshes total; ` +
      `${activeCollisionMeshes.length} active near spawn.`
  );
}

/**
 * Narrows collisionMeshes down to whatever is actually near the player.
 * This is the fix for movement lag: raycasting against every collidable mesh
 * in the whole museum (including far-off rooms) on every WASD frame was the
 * bottleneck — rotation never hit this path at all, which is why turning was
 * always smooth while walking wasn't.
 */
function refreshActiveCollisionMeshes() {
  if (!camera) return;
  const playerPos = camera.position;
  activeCollisionMeshes = collisionMeshes.filter((mesh) => {
    const sphere = mesh.userData.collisionSphere;
    if (!sphere) return true;
    return sphere.center.distanceTo(playerPos) - sphere.radius <= COLLISION_QUERY_RADIUS;
  });
}

/** Throttled: recomputes the broad-phase collision set a few times a second, not every frame. */
function updateCollisionBroadPhase(deltaSeconds) {
  if (!COLLISION_ENABLED) return;
  collisionRefreshTimer += deltaSeconds;
  if (collisionRefreshTimer < COLLISION_REFRESH_INTERVAL) return;
  collisionRefreshTimer = 0;
  refreshActiveCollisionMeshes();
}

/** Multi-height body rays (eye down to upper legs) so desks and counters block movement. */
// Room shells are single merged meshes covering floor + walls + ceiling all
// in one object, so per-asset filtering can't drop "just the floor" — this
// instead rejects individual ray HITS whose surface faces mostly up/down
// (floor/ceiling) and only lets near-vertical, wall-like surfaces block
// horizontal movement. A shallow-angle graze off an uneven floor polygon was
// occasionally registering as a wall hit and stopping/juddering the player
// in open areas — this removes floor collision from the equation entirely.
const COLLISION_MAX_FLOOR_NORMAL_Y = 0.6;
const _collisionWorldNormal = new THREE.Vector3();

function isWallLikeHit(hit) {
  if (!hit.face) return true; // no normal available — blocking is the safe default
  _collisionWorldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
  return Math.abs(_collisionWorldNormal.y) < COLLISION_MAX_FLOOR_NORMAL_Y;
}

function getAllowedMove(delta) {
  const distance = delta.length();
  if (distance < 1e-8) return _collisionMove.set(0, 0, 0);

  _collisionDir.copy(delta).normalize();
  let allowed = distance;

  for (const drop of COLLISION_BODY_OFFSETS) {
    _collisionOrigin.copy(camera.position).add(new THREE.Vector3(0, -drop, 0));
    collisionRaycaster.set(_collisionOrigin, _collisionDir);
    collisionRaycaster.far = distance + PLAYER_RADIUS;
    const hits = collisionRaycaster.intersectObjects(activeCollisionMeshes, false);
    const wallHit = hits.find(isWallLikeHit);
    if (wallHit) {
      allowed = Math.min(allowed, Math.max(0, wallHit.distance - PLAYER_RADIUS));
    }
  }

  return _collisionMove.copy(_collisionDir).multiplyScalar(allowed);
}

// This is the same collision path for every room, including Backrooms — there
// was never a separate "backrooms logic". What made Backrooms feel smooth and
// the main floor glitchy was a real bug here: whenever the direct move was
// only PARTIALLY blocked, the partial move got applied, and then the slide
// correction below re-ran using the FULL original delta instead of just the
// leftover portion — silently applying movement twice in the same frame.
// The main floor's more complex, multi-file room shells (several separate
// glbs meeting at seams/corners) trigger that partial-block path far more
// often than Backrooms' simpler layout, so the double-move stutter showed up
// there and not there. Fixed by only sliding along whatever delta didn't get
// used by the direct move.
function applyCollisionMove(delta) {
  if (!COLLISION_ENABLED || activeCollisionMeshes.length === 0) {
    camera.position.add(delta);
    return;
  }

  const move = getAllowedMove(delta);
  camera.position.add(move);
  if (move.length() >= delta.length() - 1e-4) return; // fully unobstructed — done

  const remaining = new THREE.Vector3().subVectors(delta, move);
  const slideX = getAllowedMove(new THREE.Vector3(remaining.x, 0, 0));
  const slideZ = getAllowedMove(new THREE.Vector3(0, 0, remaining.z));
  camera.position.add(slideX).add(slideZ);
}

function updateFirstPersonMovement(deltaSeconds) {
  if (uiModalOpen) return; // frozen in place while a modal has focus
  if (keyState.rotateLeft) yaw += keyTurnSpeed * deltaSeconds;
  if (keyState.rotateRight) yaw -= keyTurnSpeed * deltaSeconds;

  const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)).normalize();
  const right = new THREE.Vector3().crossVectors(forward, WORLD_UP).normalize();
  const move = new THREE.Vector3();

  if (keyState.forward) move.add(forward);
  if (keyState.backward) move.sub(forward);
  if (keyState.right) move.add(right);
  if (keyState.left) move.sub(right);

  if (move.lengthSq() > 0) {
    move.normalize().multiplyScalar(moveSpeed * deltaSeconds);
    applyCollisionMove(move);
  }

  if (isAirborne || camera.position.y > baseEyeHeight + 0.001) {
    verticalVelocity -= gravity * deltaSeconds;
    camera.position.y += verticalVelocity * deltaSeconds;

    if (camera.position.y <= baseEyeHeight) {
      camera.position.y = baseEyeHeight;
      verticalVelocity = 0;
      isAirborne = false;
      jumpsRemaining = maxJumps;
    }
  }

  lookTarget.set(
    camera.position.x + Math.sin(yaw) * Math.cos(pitch),
    camera.position.y + Math.sin(pitch),
    camera.position.z + Math.cos(yaw) * Math.cos(pitch)
  );
  camera.lookAt(lookTarget);
}


function animate() {
  requestAnimationFrame(animate);
  const deltaSeconds = clock.getDelta();
  updateAnimations(deltaSeconds);
  updateTvStatic(deltaSeconds);
  updateCollisionBroadPhase(deltaSeconds);
  updateFirstPersonMovement(deltaSeconds);
  updateTvScreenHover();
  updateSceneHover();
  updateCursorStyle();
  updateSwingDoors(deltaSeconds);
  updateSlidingDoors(deltaSeconds);
  updateNpcDialogue();
  updateComputerGlow(deltaSeconds);
  updateComputerZoom(deltaSeconds);
  updateFloorMusic(deltaSeconds);
  updateCeilingEye();
  updateMailboxFlag(deltaSeconds);
  updateVenusFlytraps(deltaSeconds);
  renderer.render(scene, camera);
}

init();
animate();
