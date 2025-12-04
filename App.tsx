import React, { useState, useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView,
 Image, StyleSheet, StatusBar, Platform, TextInput, Animated, Easing, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
// NOTE: Removed lucide-react imports (ChevronLeft, Brain, etc.) to
// eliminate the
// Invariant Violation:... component path must be a function error
// caused by
// /SVG elements. Icons are now replaced by Unicode characters/emojis.
// Tailwind CSS is assumed to be available in this environment.
// Unicode/Emoji Icon Map (RN Compliant)
const ICONS = {
  Back: '‹', // Left Chevron
  Brain: '🧠',
  BookOpen: '📖',
  Gamepad2: '🎮',
  Check: '✓',
  X: '✕',
  Medal: '🏅',
};

const colors = {
  // Gradient endpoints used by the LinearGradient background
  primaryLight: '#bbf0ff', // light blue
  primaryDark: '#0b3b82', // dark blue
  // UI surfaces
  background: 'transparent', // we render gradient behind content
  card: 'rgba(255,255,255,0.04)',
  // Accent and text palette (darker yellow & white scheme)
  accent: '#FFB300', // darker yellow (amber)
  muted: 'rgba(255,255,255,0.7)',
  text: '#FFFFFF', // primary text white for contrast
};

// Responsive content width — cap for phones and tablets so UIs stay centered
const WINDOW = Dimensions.get('window');
const CONTENT_MAX_WIDTH = Math.min(720, Math.max(340, WINDOW.width - 32, 360));

// Using `LinearGradient` from `expo-linear-gradient` for the background gradient.

const styles = StyleSheet.create({
  webButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
    marginVertical: 8,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    marginBottom: 20,
  },
  splashSubtitle: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 18,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 36 : 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    paddingTop: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0ea5a4',
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  menuButton: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryLight,
  },
});

// allow dynamic require for optional native modules (expo-av)
declare const require: any;
// Module-level (optional) expo-av wrapper. If `expo-av` is installed and `assets/correct.mp3` or
// `assets/incorrect.mp3` exist, SoundManager will load them. Otherwise it silently no-ops.
const ModuleExpoAv = (() => {
  try { return require('expo-av'); } catch (err) { return null; }
})();

// Optional AsyncStorage (dynamic require) so we don't hard-fail if not installed
const ModuleAsyncStorage = (() => {
  try { return require('@react-native-async-storage/async-storage'); } catch (err) { return null; }
})();
const AsyncStorage = ModuleAsyncStorage ? (ModuleAsyncStorage.default ?? ModuleAsyncStorage) : null;

const SoundManager = {
  enabled: true,
  sounds: {} as Record<string, any>,
  async load(name: string, asset?: any) {
    if (!ModuleExpoAv || !ModuleExpoAv.Audio || !ModuleExpoAv.Audio.Sound) return;
    try {
      const { Sound } = ModuleExpoAv.Audio;
      // Prefer the createAsync helper when available
      if (ModuleExpoAv.Audio.Sound && ModuleExpoAv.Audio.Sound.createAsync) {
        try {
          const res = await ModuleExpoAv.Audio.Sound.createAsync(asset || null, { shouldPlay: false });
          this.sounds[name] = res.sound;
        } catch (e) {
          // fallback
          const s = new Sound();
          if (asset) await s.loadAsync(asset);
          this.sounds[name] = s;
        }
      } else {
        const s = new Sound();
        if (asset) await s.loadAsync(asset);
        this.sounds[name] = s;
      }
    } catch (e) {
      // silent fallback
    }
  },
  async playBackground(asset?: any) {
    if (!ModuleExpoAv || !ModuleExpoAv.Audio) return;
    try {
      // If asset provided, create and play in loop
      if (asset) {
        // If a background sound is already loaded and playing, stop and unload it first
        try {
          const old = this.sounds['bg'];
          if (old && old.stopAsync) {
            await old.stopAsync();
          }
          if (old && old.unloadAsync) {
            await old.unloadAsync();
          }
        } catch (e) {}

        if (ModuleExpoAv.Audio.Sound && ModuleExpoAv.Audio.Sound.createAsync) {
          const res = await ModuleExpoAv.Audio.Sound.createAsync(asset, { shouldPlay: true, isLooping: true });
          // ensure initial volume if supported
          try { if (res.sound && res.sound.setVolumeAsync) await res.sound.setVolumeAsync(0.5); } catch (e) {}
          this.sounds['bg'] = res.sound;
          return;
        }
      }
      // fallback: try to play existing bg
      const s = this.sounds['bg'];
      if (s && s.playAsync) await s.playAsync();
    } catch (e) {}
  },
  async play(name: string) {
    if (!this.enabled) return;
    const s = this.sounds[name];
    if (!s || (!s.replayAsync && !s.playAsync)) return;
    try {
      if (s.replayAsync) await s.replayAsync();
      else if (s.playAsync) await s.playAsync();
    } catch (e) {}
  },
  async unloadAll() {
    if (!ModuleExpoAv) return;
    for (const k of Object.keys(this.sounds)) {
      try { await this.sounds[k].unloadAsync?.(); } catch (e) {}
    }
    this.sounds = {} as Record<string, any>;
  },
  // Set background music volume (0.0 - 1.0). No-op if background sound not present.
  async setBackgroundVolume(vol: number) {
    try {
      const s = this.sounds['bg'];
      if (!s) return;
      const v = Math.max(0, Math.min(1, vol));
      if (s.setVolumeAsync) {
        await s.setVolumeAsync(v);
      } else if (s.setStatusAsync) {
        await s.setStatusAsync({ volume: v });
      }
    } catch (e) {}
  },
  // Attempt to read current background volume. Returns number or null.
  async getBackgroundVolume() {
    try {
      const s = this.sounds['bg'];
      if (!s) return null;
      if (s.getStatusAsync) {
        const st = await s.getStatusAsync();
        if (st && typeof st.volume === 'number') return st.volume;
      }
    } catch (e) {}
    return null;
  }
  ,
  // Stop and unload only the background sound (keeps other sounds loaded)
  async stopBackground() {
    try {
      const s = this.sounds['bg'];
      if (!s) return;
      try { if (s.stopAsync) await s.stopAsync(); } catch (e) {}
      try { if (s.unloadAsync) await s.unloadAsync(); } catch (e) {}
      delete this.sounds['bg'];
    } catch (e) {}
  }
};


type PressableProps = {
  children?: React.ReactNode;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  style?: any;
};

const Pressable: React.FC<PressableProps> = ({ children, onPress, disabled = false, style }) => {
  // Use TouchableOpacity so buttons are tappable on mobile.
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={disabled ? 1 : 0.75}
      style={style}
    >
      {children}
    </TouchableOpacity>
  );
};

// Custom Button component (now uses simple character for icon)
type WebButtonProps = {
  title: string;
  onPress: () => void;
  style?: any;
  disabled?: boolean;
  iconChar?: string;
  imageSrc?: string;
  className?: string;
  textColor?: string;
};

const WebButton: React.FC<WebButtonProps> = ({ title, onPress, style, disabled = false, iconChar, imageSrc, textColor }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={{
      // Base button sizing to make buttons consistent across screens
      width: '100%',
      alignSelf: 'stretch',
      minHeight: 48,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: disabled ? 'rgba(255,255,255,0.03)' : colors.primaryDark,
      opacity: disabled ? 0.7 : 1,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.06)',
      ...style,
    }}
  >
    {imageSrc ? (
      <Image source={{ uri: imageSrc }} style={{ width: 32, height: 32, borderRadius: 8, marginRight: 8 }} />
    ) : iconChar ? (
      <Text style={{ fontSize: 18, marginRight: 8, color: colors.accent }}>{iconChar}</Text>
    ) : null}
    <Text style={{ color: disabled ? colors.muted : (textColor ?? colors.text), fontWeight: '700', fontSize: 16, textAlign: 'center' }}>{title}</Text>
  </Pressable>
);

// Animated Logo Component
const AppLogo = ({ style }: { style?: any }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', ...style }} >
    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 32, marginRight: 8 }}>CRACK</Text>
    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 32, marginRight: 8 }}>THE</Text>
    <Text style={{ color: colors.accent, fontWeight: 'bold', fontSize: 32, marginLeft: 8 }}>MYTH</Text>
  </View>
);

// Reusable wrapper to center screens and keep consistent width/padding
const CenteredScreen: React.FC<{ children?: React.ReactNode; innerStyle?: any; outerStyle?: any }> = ({ children, innerStyle, outerStyle }) => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, paddingTop: 40, width: '100%', ...outerStyle }}>
      <View style={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignItems: 'center', justifyContent: 'center', ...innerStyle }}>
        {children}
      </View>
  </View>
);

// DATA STRUCTURE: App Content (Quizzes, Books, Games)


// --- QUIZ QUESTION ENTRY TEMPLATE ---
// To add/edit quiz questions, use the format below. Easy levels: 2 choices. Medium/Hard: 4 choices.
// Example:
// {
//   q: "What is the half-life of Uranium-235?",
//   a: "703.8 million years",
//   options: ["703.8 million years", "4.5 billion years"], // Easy: 2 choices
//   explanation: "Uranium-235 has a half-life of 703.8 million years."
// }
// For medium/hard:
// {
//   q: "Which is NOT a product of nuclear fission?",
//   a: "Alpha particle",
//   options: ["Neutron", "Alpha particle", "Krypton", "Barium"], // Medium/Hard: 4 choices
//   explanation: "Alpha particles are not produced in fission; neutrons and fission fragments like krypton and barium are."
// }

// --- LEARNING MODULE ENTRY TEMPLATE ---
// To add/edit learning modules, use the format below:
// {
//   id: 'B6',
//   title: 'New Module Title',
//   content: "Your module content here.",
//   reference: "Source or reference here."
// }

// Helper function to enforce choices per level
function enforceChoices(level: 'Easy' | 'Medium' | 'Hard', questions: any[]) {
  return questions.map(q => ({
    ...q,
    options: level === 'Easy' ? q.options.slice(0, 2) : q.options.slice(0, 4)
  }));
}

const appData = {
  // 2. Quizzes: Restructure with Categories and Difficulty Levels 🧠
  // Five categories. Easy = 5 Qs (2 choices each), Medium = 10 Qs (4 choices), Hard = 15 Qs (4 choices).
  quizzes: [
    {
      id: 'QZ1',
      title: 'introduction to half-life',
      levels: [
        {
          id: 'QZ1-E',
          title: 'Easy',
          questions: enforceChoices('Easy', [
            { q: 'When was the term "half-life" introduced?', a: '1907', options: ['1907', '1950'], explanation: 'Ernest Rutherford introduced the term in 1907.' },
            { q: 'The time it takes for half of a quantity to decay is called the...', a: 'Half-life', options: ['Half-life', 'Quarter-life'], explanation: 'Half-life is the time required for half of a substance to decay.' },
            { q: 'True or False: Exactly half of the substance decays after one half-life.', a: 'False', options: ['True', 'False'], explanation: 'Decay is probabilistic; exact halving is an idealized expectation for large samples.' },
            { q: 'Who coined the term "half-life"?', a: 'Ernest Rutherford', options: ['Ernest Rutherford', 'Marie Curie'], explanation: 'Ernest Rutherford first used the term to describe decay rates.' },
            { q: 'In N(t) = N0 · e^{-lambda t}, what does lambda represent?', a: 'Decay constant', options: ['Initial quantity', 'Decay constant'], explanation: 'Lambda is the decay constant, which sets the rate of exponential decay.' }
          ])
        },
        {
          id: 'QZ1-M',
          title: 'Medium',
          questions: enforceChoices('Medium', [
            { q: 'Which mathematical form describes decay proportional to the current value?', a: 'Exponential decay', options: ['Linear decay', 'Exponential decay', 'Logarithmic decay', 'No decay'], explanation: 'Exponential decay has a rate proportional to the current amount.' },
            { q: 'What is biological half-life?', a: 'Time to eliminate half the substance biologically', options: ['Time to eliminate half the substance biologically', 'Time to chemically alter half', 'Time to heat by half', 'None of the above'], explanation: 'Biological half-life refers to elimination via biological processes.' },
            { q: 'After two half-lives, what fraction remains?', a: '1/4', options: ['1/2', '1/4', '1/8', '3/4'], explanation: '(1/2)^2 = 1/4.' },
            { q: 'A 75 g sample, t1/2 = 5730 years: how much after 11460 years?', a: '18.75 g', options: ['18.75 g', '37.5 g', '75 g', '9.375 g'], explanation: '11460 = 2 half-lives, so 75 * (1/2)^2 = 18.75 g.' },
            { q: 'What fraction remains after three half-lives?', a: '1/8', options: ['1/2', '1/4', '1/8', '1/16'], explanation: '(1/2)^3 = 1/8.' },
            { q: 'Which describes a first-order reaction?', a: 'Rate proportional to concentration', options: ['Rate independent', 'Rate proportional to concentration', 'Rate proportional to square', 'Rate increases'], explanation: 'First-order reactions have rate ∝ concentration.' },
            { q: 'What is an e-folding time?', a: 'Time to decrease by factor e', options: ['Time to double', 'Time to decrease by factor e', 'Time to halve', 'No relation'], explanation: 'E-folding time is when amount falls to 1/e of initial.' },
            { q: 'Why are half-lives useful?', a: 'Predict average behaviour of many atoms', options: ['Predict exact atom behaviour', 'Predict average behaviour of many atoms', 'Measure temperature', 'Calculate mass'], explanation: 'Half-lives predict average decay behaviour for large samples.' },
            { q: 'Is radioactive decay deterministic for single atoms?', a: 'No, it is probabilistic', options: ['Yes', 'No, it is probabilistic'], explanation: 'Single-atom decay is random; statistics apply to ensembles.' },
            { q: 'Which unit approximates ln(2)?', a: '0.693', options: ['0.5', '0.693', '1.0', '2.0'], explanation: 'ln(2) ≈ 0.693, used in t1/2 = ln(2)/lambda.' }
          ])
        },
        {
          id: 'QZ1-H',
          title: 'Hard',
          questions: enforceChoices('Hard', [
            { q: 'How many half-lives have passed after 12000 years if t1/2 = 5730 years?', a: 'About 2.1', options: ['About 2.1', 'About 1.5', 'About 3.0', 'About 4.0'], explanation: '12000 / 5730 ≈ 2.094, so about 2.1 half-lives.' },
            { q: 'What fraction remains after 5 half-lives?', a: '1/32', options: ['1/16', '1/32', '1/8', '1/64'], explanation: '(1/2)^5 = 1/32.' },
            { q: 'Which radiation is high-energy electromagnetic radiation from the nucleus?', a: 'Gamma radiation', options: ['Alpha particle', 'Beta particle', 'Gamma radiation', 'Neutron'], explanation: 'Gamma rays are high-energy photons emitted by nuclei.' },
            { q: 'What is the relation between half-life and decay constant lambda?', a: 't1/2 = ln(2)/lambda', options: ['t1/2 = ln(2)/lambda', 't1/2 = lambda/ln(2)', 't1/2 = 2*lambda', 'No relation'], explanation: 'The standard relation is t1/2 = ln(2) / lambda.' },
            { q: 'If 75% is lost in 16 days, what is the half-life?', a: '8 days', options: ['8 days', '4 days', '16 days', '2 days'], explanation: '75% lost means 25% remains: that is two half-lives, so 16/2 = 8 days.' },
            { q: 'What does a decay series describe?', a: 'Sequence of decays to a stable isotope', options: ['A single decay step', 'Sequence of decays to a stable isotope', 'Fusion process', 'Chemical reaction'], explanation: 'A decay series is a chain of decays leading to a stable nucleus.' },
            { q: 'What is the numerical value of ln(2)?', a: '0.693', options: ['0.693', '0.5', '1.0', '2.0'], explanation: 'ln(2) ≈ 0.693.' },
            { q: 'Which factor least affects biological half-life?', a: 'Initial quantity', options: ['Age', 'Metabolism', 'Organ function', 'Initial quantity'], explanation: 'Biological half-life depends on biological processes, not the initial dose in most cases.' },
            { q: 'What causes the majority of heat in a reactor after fission?', a: 'Kinetic energy of fragments converted to heat', options: ['Gamma rays', 'Kinetic energy of fragments converted to heat', 'Neutron emission', 'Chemical reactions'], explanation: 'Fission fragments deposit kinetic energy as heat.' },
            { q: 'What term describes a self-sustaining chain reaction with k = 1?', a: 'Critical', options: ['Critical', 'Subcritical', 'Supercritical', 'Transient'], explanation: 'Critical means steady chain reaction with multiplication factor k = 1.' }
          ])
        }
      ]
    },
    {
      id: 'QZ2',
      title: 'understanding nuclear fission',
      levels: [
        {
          id: 'QZ2-E',
          title: 'Easy',
          questions: enforceChoices('Easy', [
            { q: 'True or False: Fission requires the nucleus to exceed a critical energy threshold.', a: 'True', options: ['True', 'False'], explanation: 'Fission occurs when the nucleus reaches a threshold energy that allows it to split.' },
            { q: 'True or False: Two or more neutrons are typically released during fission.', a: 'True', options: ['True', 'False'], explanation: 'A fission event commonly emits two or more neutrons, which may continue the chain reaction.' },
            { q: 'Who discovered nuclear fission?', a: 'Otto Hahn and Fritz Strassmann', options: ['Otto Hahn and Fritz Strassmann', 'Enrico Fermi'], explanation: 'Otto Hahn and Fritz Strassmann discovered nuclear fission in 1938.' },
            { q: 'What term describes a heavy nucleus splitting into smaller nuclei?', a: 'Nuclear fission', options: ['Nuclear fission', 'Nuclear fusion'], explanation: 'Fission is the process of a heavy nucleus splitting into two or more lighter nuclei.' },
            { q: 'What term describes two nuclei combining into one?', a: 'Nuclear fusion', options: ['Nuclear fusion', 'Nuclear fission'], explanation: 'Fusion combines light nuclei into a heavier nucleus.' }
          ])
        },
        {
          id: 'QZ2-M',
          title: 'Medium',
          questions: enforceChoices('Medium', [
            { q: 'Which type of fission is typically used in reactors because it is controllable?', a: 'Neutron-induced', options: ['Spontaneous', 'Neutron-induced', 'Alpha-induced', 'Photon-induced'], explanation: 'Neutron-induced fission allows control through neutron economy and moderation.' },
            { q: 'What can neutrons emitted during fission trigger?', a: 'A chain reaction', options: ['Fusion', 'Beta decay', 'A chain reaction', 'Gamma emission'], explanation: 'Emitted neutrons can induce further fission, creating a chain reaction.' },
            { q: 'Which isotope commonly supports a self-sustaining chain reaction?', a: 'U-235', options: ['U-238', 'U-235', 'Pu-238', 'C-14'], explanation: 'U-235 is a common fissile isotope used in reactors.' },
            { q: 'Approximately how much energy is released per U-235 fission?', a: 'About 200 MeV', options: ['About 5 MeV', 'About 200 MeV', '1 GW', '1 kJ'], explanation: 'A single U-235 fission releases on the order of 200 MeV of energy.' },
            { q: 'What does MWd stand for in reactor energy terms?', a: 'Megawatt-day', options: ['Megawatt-day', 'Megawatt-degree', 'Milliwatt-day', 'Mega-watt density'], explanation: 'MWd means megawatt-day, an energy/time measure used in reactor fuel accounting.' },
            { q: 'Why is a moderator used in many reactors?', a: 'To slow down neutrons', options: ['To absorb neutrons', 'To slow down neutrons', 'To increase temperature', 'To produce gamma rays'], explanation: 'Moderators slow fast neutrons to thermal energies where fission is more likely for U-235.' },
            { q: 'Roughly how many fissions per second produce 1 watt of power?', a: 'About 3.1 × 10^10', options: ['10^6', '3.1 × 10^10', '2.5 × 10^21', '439'], explanation: 'Approximately 3.1 × 10^10 fissions per second correspond to ~1 watt.' },
            { q: 'What does it mean if a chain reaction is critical?', a: 'The reaction is self-sustaining (k = 1)', options: ['k < 1', 'k = 1', 'k > 1', 'k = 0'], explanation: 'Critical means each generation of neutrons sustains the next: k = 1.' },
            { q: 'Which neutron is most effective at causing fission in U-235?', a: 'Thermal neutron', options: ['Fast neutron', 'Thermal neutron', 'Delayed neutron', 'Prompt neutron'], explanation: 'Thermal neutrons are more likely to induce fission in U-235.' },
            { q: 'What are fission fragments typically like?', a: 'Highly radioactive', options: ['Stable', 'Highly radioactive', 'Only gamma emitters', 'Only alpha emitters'], explanation: 'Fission fragments are neutron-rich and typically radioactive.' }
          ])
        },
        {
          id: 'QZ2-H',
          title: 'Hard',
          questions: enforceChoices('Hard', [
            { q: 'Why is spontaneous fission not suitable for reactor power generation?', a: 'It is too rare and uncontrolled', options: ['It is too rare and uncontrolled', 'It releases too much energy', 'It produces no neutrons', 'It requires fusion'], explanation: 'Spontaneous fission rates are low and unpredictable for controlled power.' },
            { q: 'Which isotope listed is not typically fissile for sustaining a chain reaction?', a: 'Pu-240', options: ['U-233', 'U-235', 'Pu-239', 'Pu-240'], explanation: 'Pu-240 is not a primary fissile isotope for sustaining a chain reaction.' },
            { q: 'Why does fission release energy?', a: 'Products have higher binding energy per nucleon', options: ['Products have lower binding energy', 'Products have higher binding energy per nucleon', 'Mass is created', 'Neutrons disappear'], explanation: 'Energy is released because products are more tightly bound; mass difference becomes energy.' },
            { q: 'What happens to the kinetic energy of fission fragments?', a: 'Converted to heat in the reactor', options: ['Emitted as light', 'Converted to heat in the reactor', 'Escapes as neutrinos', 'Stored as potential energy'], explanation: 'Fragment kinetic energy is deposited as heat in the fuel and coolant.' },
            { q: 'What role does a moderator play?', a: 'It slows neutrons to thermal energies', options: ['It speeds neutrons', 'It slows neutrons', 'It absorbs heat', 'It moderates temperature'], explanation: 'Moderators reduce neutron energy to increase fission probability in fissile materials.' },
            { q: 'Approximately how many atoms are in one gram of fissile material (order of magnitude)?', a: 'About 10^21', options: ['10^15', '10^21', '10^23', '10^9'], explanation: 'One gram contains roughly 10^21 atoms, depending on the isotope.' },
            { q: 'What does MWd measure?', a: 'Energy produced per unit mass/time (megawatt-day)', options: ['Power', 'Energy per day', 'Energy (megawatt-day)', 'Temperature'], explanation: 'MWd is a unit for energy produced over a day at megawatt power.' },
            { q: 'What is the neutron multiplication factor k when the reaction is supercritical?', a: 'k > 1', options: ['k < 1', 'k = 1', 'k > 1', 'k = 0'], explanation: 'Supercritical means the chain reaction grows: k > 1.' },
            { q: 'What does criticality mean in reactor physics?', a: 'Neutron production equals losses (k = 1)', options: ['Neutron production increases', 'Neutron production equals losses', 'Neutron production stops', 'Neutron production oscillates'], explanation: 'Criticality means a steady-state chain reaction where k = 1.' },
            { q: 'Why are fission fragments radioactive?', a: 'They are neutron-rich and unstable', options: ['They are proton-rich', 'They are neutron-rich and unstable', 'They are stable', 'They are cold'], explanation: 'Fragments are typically neutron-rich and decay to reach stability.' }
          ])
        }
      ]
    },
    {
      id: 'QZ3',
      title: 'radiation in daily life',
      levels: [
        {
          id: 'QZ3-E',
          title: 'Easy',
          questions: enforceChoices('Easy', [
            { q: 'Does radiation from outer space exist?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Radiation from outer space is called cosmic radiation or cosmic rays.' },
            { q: 'Does radiation only come from radioactive materials?', a: 'No', options: ['Yes', 'No'], explanation: 'Radiation includes many forms of energy, not just from radioactive materials.' },
            { q: 'Are naturally occurring radioactive materials present in food?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Naturally occurring radioactive materials are present in food and drink.' },
            { q: 'Are X-rays a source of man-made radiation exposure?', a: 'Yes', options: ['No', 'Yes'], explanation: 'X-rays are a common source of man-made radiation.' },
            { q: 'Has radioactivity always been part of Earth?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Natural radioactivity has existed on Earth throughout its history.' }
          ])
        },
        {
          id: 'QZ3-M',
          title: 'Medium',
          questions: enforceChoices('Medium', [
            { q: 'What does "radiation" refer to in simple terms?', a: 'Release or movement of energy', options: ['Release or movement of energy', 'Decay of atoms', 'Creation of isotopes', 'Nuclear chain reaction'], explanation: 'Radiation refers to the release and movement of energy from a source.' },
            { q: 'What is the radiation we receive from outer space called?', a: 'Cosmic rays', options: ['Terrestrial', 'Alpha', 'Cosmic rays', 'Man-made'], explanation: 'Radiation from space is called cosmic rays.' },
            { q: 'Which is an example of man-made radiation exposure?', a: 'Cancer therapy', options: ['Cosmic rays', 'Radioactive air', 'Cancer therapy', 'Body elements'], explanation: 'Medical therapies like radiation for cancer are examples of man-made exposure.' },
            { q: 'Where are naturally occurring radioactive materials found in homes?', a: 'Floors, walls, ceilings', options: ['Only wiring', 'Only water pipes', 'Floors, walls, ceilings', 'Only outside'], explanation: 'Some building materials contain naturally occurring radioactive elements.' },
            { q: 'What is one source of man-made exposure from power plants?', a: 'Small material release', options: ['Absorbed cosmic rays', 'Electrical current', 'Small material release', 'Steam release'], explanation: 'Small releases of material from power plants can contribute to exposure.' },
            { q: 'Which parts of our bodies contain natural radioactive elements?', a: 'Muscles, bones, tissue', options: ['Hair', 'Blood', 'Muscles, bones, tissue', 'Brain'], explanation: 'Our muscles, bones, and tissues contain trace natural radioactive isotopes.' },
            { q: 'Which US agency is cited for examples of radiation in daily life?', a: 'CDC', options: ['IAEA', 'DOE', 'FDA', 'CDC'], explanation: 'The Centers for Disease Control (CDC) offers examples of radiation in daily life.' },
            { q: 'Which of these is an example of daily radiation exposure?', a: 'Airport screening', options: ['Wearing a watch', 'Listening to radio', 'Using a microwave', 'Airport screening'], explanation: 'Airport screening is an example of man-made exposure during travel.' },
            { q: 'What international agency is mentioned regarding earth radioactivity?', a: 'IAEA', options: ['WNA', 'CDC', 'DOE', 'IAEA'], explanation: 'The International Atomic Energy Agency (IAEA) provides information on natural radioactivity.' },
            { q: 'Are radioactive isotopes present in our bodies?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Our bodies contain trace amounts of naturally occurring radioactive isotopes.' }
          ])
        },
        {
          id: 'QZ3-H',
          title: 'Hard',
          questions: enforceChoices('Hard', [
            { q: 'Which is a source of man-made radiation exposure?', a: 'Fallout from testing', options: ['Cosmic rays', 'Earth crust materials', 'Air gases', 'Fallout from testing'], explanation: 'Fallout from nuclear tests is a source of man-made exposure.' },
            { q: 'What is the distinction between radiation and radioactive materials?', a: 'Radiation is energy movement', options: ['Materials are man-made', 'Radiation is only light', 'Radiation is energy movement', 'Materials only in air'], explanation: 'Radiation is the movement of energy; radioactive materials are sources.' },
            { q: 'Where are naturally occurring radioactive materials in the Earth?', a: 'In the crust', options: ['In satellites', 'In the crust', 'In X-ray machines', 'In spent fuel'], explanation: 'Naturally occurring radioactive materials are found in the Earth\'s crust.' },
            { q: 'Man-made radiation is used for diagnostic X-rays and what medical purpose?', a: 'Cancer therapy', options: ['Vaccine development', 'Blood transfusions', 'Dental cleanings', 'Cancer therapy'], explanation: 'Medical radiation is used in diagnostics and cancer therapy.' },
            { q: 'What are the two broad categories of radiation sources?', a: 'Natural and man-made', options: ['Alpha and Beta', 'Indoor and Outdoor', 'Natural and man-made', 'Low-level and High-level'], explanation: 'Radiation sources are typically natural or man-made.' },
            { q: 'Where are radioactive gases mentioned as present?', a: 'In the air we breathe', options: ['Concrete', 'In the air we breathe', 'Electricity', 'Light'], explanation: 'Trace radioactive gases are present in the air.' },
            { q: 'Which type of radiation is UV?', a: 'Non-radioactive energy', options: ['Radioactive gas', 'Cosmic ray', 'Non-radioactive energy', 'Fission byproduct'], explanation: 'UV radiation is non-ionizing electromagnetic radiation.' },
            { q: 'What is a natural radiation source humans have always been exposed to?', a: 'Radiation from the earth', options: ['Medical procedures', 'Radiation from the earth', 'Power plant release', 'Airport screening'], explanation: 'Earth-origin radiation is a persistent natural source.' },
            { q: 'What small amounts are carried by the air we breathe?', a: 'Trace radioactive gases', options: ['Liquid waste', 'Trace radioactive gases', 'Solid metals', 'High-level waste'], explanation: 'The air contains trace radioactive gases.' },
            { q: 'Which location is NOT commonly listed for radioactive substances?', a: 'Man-made satellites', options: ['Floors of homes', 'Walls of workplaces', 'Ceilings of homes', 'Man-made satellites'], explanation: 'Radioactive materials are commonly found in building materials, not satellites.' }
          ])
        }
      ]
    },
    {
      id: 'QZ4',
      title: 'safe nuclear waste management',
      levels: [
        {
          id: 'QZ4-E',
          title: 'Easy',
          questions: enforceChoices('Easy', [
            { q: 'Is a naturally radioactive, no-longer-useful material classified as waste?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Radioactive waste is any material that is radioactive or contaminated and is no longer considered useful.' },
            { q: 'Does High-Level Waste make up the largest volume of radioactive waste?', a: 'No', options: ['Yes', 'No'], explanation: 'High-Level Waste (HLW) is a small fraction of the total waste volume.' },
            { q: 'Do all radioactive materials eventually decay to stable forms?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Over time, radioactive materials decay into stable, non-radioactive isotopes.' },
            { q: 'Does Low-Level Waste require heavy shielding during transport?', a: 'No', options: ['Yes', 'No'], explanation: 'Low-Level Waste (LLW) generally does not need heavy shielding for handling or transport.' },
            { q: 'Is spent nuclear fuel a source of High-Level Waste?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Spent nuclear fuel and some reprocessing residues are examples of HLW.' }
          ])
        },
        {
          id: 'QZ4-M',
          title: 'Medium',
          questions: enforceChoices('Medium', [
            { q: 'Which waste category is often disposed of with domestic refuse?', a: 'VLLW', options: ['LLW', 'ILW', 'HLW', 'VLLW'], explanation: 'Very Low-Level Waste (VLLW) can be disposed with regular refuse in some jurisdictions.' },
            { q: 'Which radiation type is commonly associated with short-lived radionuclides?', a: 'Gamma radiation', options: ['Alpha', 'Beta', 'Gamma radiation', 'Neutron'], explanation: 'Short-lived radionuclides often emit penetrating gamma radiation.' },
            { q: 'Approximately what share of activity does ILW account for?', a: 'About 4%', options: ['About 95%', 'About 1%', 'About 4%', 'About 7%'], explanation: 'Intermediate-Level Waste accounts for a small percentage of total radioactivity compared with HLW.' },
            { q: 'Which waste category is suitable for near-surface disposal?', a: 'LLW', options: ['LLW', 'ILW', 'HLW', 'VLLW'], explanation: 'Low-Level Waste is typically suitable for near-surface disposal.' },
            { q: 'What does LLW commonly include?', a: 'Paper, tools, clothing', options: ['Spent fuel', 'Resins/sludges', 'Demolished concrete', 'Paper, tools, clothing'], explanation: 'LLW includes items such as paper, tools, clothing, and filters.' },
            { q: 'Why does HLW require cooling and shielding?', a: 'It produces heat and intense radiation', options: ['It is easy to handle', 'It produces heat and intense radiation', 'It decays quickly', 'It is only liquid'], explanation: 'HLW emits heat and high radiation, requiring cooling and shielding.' },
            { q: 'Which waste is often solidified in concrete or bitumen?', a: 'ILW', options: ['LLW', 'ILW', 'HLW', 'VLLW'], explanation: 'Intermediate-Level Waste is sometimes immobilized in concrete or bitumen for disposal.' },
            { q: 'Give one example of HLW', a: 'Used fuel declared as waste', options: ['Paper and cloth', 'Used fuel declared as waste', 'Household trash', 'Construction debris'], explanation: 'Used nuclear fuel declared as waste is a primary example of HLW.' }
          ])
        },
        {
          id: 'QZ4-H',
          title: 'Hard',
          questions: enforceChoices('Hard', [
            { q: 'Which statement describes LLW volume vs activity?', a: 'High volume, low activity', options: ['Low volume, low activity', 'High volume, low activity', 'Low volume, high activity', 'High volume, high activity'], explanation: 'LLW typically represents a large volume but a small fraction of total radioactivity.' },
            { q: 'What radiation types are easier to shield?', a: 'Alpha and beta', options: ['Gamma', 'Alpha and beta', 'Neutron', 'X-ray'], explanation: 'Alpha and beta emissions are generally easier to shield than gamma or neutron radiation.' },
            { q: 'Why is HLW a major management focus?', a: 'It has high radioactivity and heat output', options: ['It is cheap to store', 'It has high radioactivity and heat output', 'It is harmless', 'It is only produced in small amounts'], explanation: 'HLW is intensely radioactive and can produce heat, making safe isolation and cooling essential.' },
            { q: 'What is another source of HLW besides spent fuel?', a: 'Reprocessing residues', options: ['Household waste', 'Reprocessing residues', 'Office paper', 'Used batteries'], explanation: 'Reprocessing of used fuel produces high-activity liquid and solid residues categorized as HLW.' },
            { q: 'Roughly what heat output threshold makes cooling necessary for waste?', a: 'About 2 kW/m^3 or higher', options: ['Less than 0.1 kW/m^3', 'About 2 kW/m^3 or higher', 'Any heat output', 'No threshold'], explanation: 'When waste generates heat above a few kW per cubic meter, cooling considerations become important.' },
            { q: 'Which category accounts for the largest share of radioactivity?', a: 'HLW', options: ['LLW', 'ILW', 'HLW', 'VLLW'], explanation: 'HLW accounts for the majority of radioactivity despite being a small volume.' },
            { q: 'What materials are common in VLLW from dismantling?', a: 'Concrete and metal', options: ['Spent fuel', 'Resins/cladding', 'Paper/filters', 'Concrete and metal'], explanation: 'VLLW often consists of demolished concrete, plaster, bricks, and metal from decommissioning.' },
            { q: 'What determines whether spent fuel is classified as waste?', a: 'National policy and regulation', options: ['Half-life only', 'Total volume', 'National policy and regulation', 'Radiation type only'], explanation: 'Classification depends on national policy and legal definitions.' },
            { q: 'One method to reduce LLW volume?', a: 'Compacting or incinerating', options: ['Leaving it as is', 'Compacting or incinerating', 'Diluting with water', 'Exporting it'], explanation: 'Volume reduction techniques include compaction and controlled incineration.' },
            { q: 'Which organization provides commonly used waste category definitions?', a: 'World Nuclear Association', options: ['IAEA', 'World Nuclear Association', 'CDC', 'DOE'], explanation: 'Organizations like the World Nuclear Association and IAEA provide guidance on categories and practices.' }
          ])
        }
      ]
    },
    {
      id: 'QZ5',
      title: 'advanced reactor concepts',
      levels: [
        {
          id: 'QZ5-E',
          title: 'Easy',
          questions: enforceChoices('Easy', [
            { q: 'Does "Advanced Nuclear" refer to a new generation of reactors?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Advanced nuclear refers to next-generation reactor designs with improved features.' },
            { q: 'Are Small Modular Reactors (SMRs) considered advanced reactors?', a: 'Yes', options: ['No', 'Yes'], explanation: 'SMRs are a compact, factory-built approach that is often classed as advanced.' },
            { q: 'Do advanced reactors aim to improve safety and efficiency?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Advanced reactors aim to improve safety, efficiency, and cost-effectiveness.' },
            { q: 'Does development of advanced reactors often depend on policy support?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Public policy and funding accelerate development and deployment.' },
            { q: 'Can non-water-cooled designs be considered advanced reactors?', a: 'Yes', options: ['No', 'Yes'], explanation: 'Non-water-cooled designs include molten salt and gas-cooled reactors.' }
          ])
        },
        {
          id: 'QZ5-M',
          title: 'Medium',
          questions: enforceChoices('Medium', [
            { q: 'Which is an example of a non-water-cooled advanced reactor?', a: 'Molten salt reactors', options: ['Light-water', 'Boiling water', 'Molten salt reactors', 'Pressurized water'], explanation: 'Molten salt reactors use liquid fuel or coolant and are non-water-cooled.' },
            { q: 'What is the SMR electrical output threshold (IAEA)?', a: 'About 300 MW or less', options: ['About 100 MW or less', 'About 300 MW or less', 'About 500 MW or less', 'About 1000 MW or less'], explanation: 'SMRs are often defined as having an electrical output around 300 MW or less.' },
            { q: 'One benefit supporters cite for SMRs?', a: 'Mass factory production', options: ['Higher financing risks', 'Custom on-site builds', 'Mass factory production', 'Uses only traditional fuel'], explanation: 'SMRs may benefit from factory production and modular assembly.' },
            { q: 'What term describes reactors designed for improved safety, efficiency, and cost?', a: 'Advanced nuclear', options: ['Legacy reactors', 'Advanced nuclear', 'Coal-fired', 'Gas turbines'], explanation: 'These are broadly referred to as advanced nuclear.' },
            { q: 'Which concept is listed as a type of advanced reactor?', a: 'Lead-cooled fast reactors', options: ['Graphite moderated', 'Heavy water', 'Lead-cooled fast reactors', 'Open-cycle gas'], explanation: 'Lead-cooled fast reactors are one example of non-water fast designs.' },
            { q: 'Which nation is cited as having a growing advanced nuclear sector?', a: 'United States', options: ['China', 'Russia', 'France', 'United States'], explanation: 'Several countries, including the United States, have active advanced reactor programs.' },
            { q: 'Which improved water-cooled system is mentioned?', a: 'Supercritical water reactors', options: ['Heavy water', 'Graphite moderated', 'Supercritical water reactors', 'Breeder reactors'], explanation: 'Supercritical water reactors are an example of improved water-cooled designs.' },
            { q: 'How many ventures were identified in a 2015 analysis?', a: 'Nearly 50', options: ['Fewer than 10', 'Nearly 50', 'Over 100', 'Exactly 300'], explanation: 'A 2015 study reported nearly 50 ventures focused on advanced reactors.' }
          ])
        },
        {
          id: 'QZ5-H',
          title: 'Hard',
          questions: enforceChoices('Hard', [
            { q: 'What three core improvements do advanced reactors aim for?', a: 'Safety, efficiency, and cost', options: ['Speed, power, size', 'Safety, efficiency, and cost', 'Complexity, cost, delay', 'Reprocessing, waste, regulation'], explanation: 'Advanced reactors prioritize safety, efficiency, and reduced costs.' },
            { q: 'Which improved water-cooled design can be small and modular?', a: 'SMR light-water reactors', options: ['Large traditional PWRs', 'SMR light-water reactors', 'Heavy water reactors', 'Old BWRs'], explanation: 'SMR light-water designs adapt proven technology to modular construction.' },
            { q: 'Name two non-water-cooled fast reactor types.', a: 'Sodium or lead fast reactors', options: ['Graphite moderated', 'Sodium or lead fast reactors', 'Molten salt or supercritical', 'Fusion reactors'], explanation: 'Sodium and lead fast reactors are examples of non-water fast designs.' },
            { q: 'What financial advantage is often claimed for SMRs?', a: 'Lower financing risks', options: ['Higher financing costs', 'Lower financing risks', 'No government backing', 'Higher capital cost'], explanation: 'SMRs may lower financing risk through modular, repeatable manufacturing.' },
            { q: 'What kinds of concepts does advanced nuclear cover?', a: 'Water, non-water, and fusion concepts', options: ['Only non-water', 'Only light-water', 'Water, non-water, and fusion concepts', 'Only large reactors'], explanation: 'The field includes improved water-cooled, non-water-cooled, and advanced fusion research.' },
            { q: 'What was the estimated private investment supporting ventures (2015)?', a: 'Over a billion dollars', options: ['Only government grants', 'Under a million dollars', 'Over a billion dollars', 'Under 100 million dollars'], explanation: 'Private investment supporting the sector exceeded a billion dollars in some analyses.' },
            { q: 'What factor is crucial for continued progress?', a: 'Federal policy and support', options: ['Increasing fossil prices', 'Independent private funding', 'Federal policy and support', 'Decommissioning old plants'], explanation: 'Policy support and funding are important for development and deployment.' },
            { q: 'Which organization provided the 2015 industry analysis?', a: 'Third Way', options: ['IAEA', 'DOE', 'Third Way', 'Science Notes'], explanation: 'Third Way published an analysis identifying many ventures.' }
          ])
        }
      ]
    },
  ],
  // 4. Learning Modules: Add/edit modules below
  books: [
    {
      id: 'B1',
      title: 'Introduction to Half-Life',
      content: "Radioactive materials decay over time, reducing their radioactivity. The time it takes for **half** of the atoms in a radioactive substance to decay is called its **half-life**. Half-lives can range from fractions of a second to billions of years. This process is predictable and crucial for dating artifacts and safely managing nuclear waste. The amount of material remaining after $n$ half-lives can be calculated using the formula: $N(t) = N_0(1/2)^{n}$. This decay process is the key to understanding why high-level nuclear waste eventually becomes less radioactive than the original uranium ore, albeit over a very long time. The half-life concept is vital in nuclear physics, determining the practical lifespan of isotopes used in medicine (which require short half-lives for patient safety) and calculating the necessary storage time for long-lived waste. The predictability of this decay is what allows scientists to reliably calculate long-term safety requirements for nuclear waste repositories, assuring public safety over geological timescales. The rate is fundamentally a property of the isotope and is unaffected by external factors like temperature, pressure, or chemical state. This is a robust and immutable law of physics.",
      reference: "Argonne National Laboratory, Oak Ridge Associated Universities."
    },
    {
      id: 'B2',
      title: 'Radiation Basics',
      content: "Overview of ionizing radiation: types (alpha, beta, gamma), units (Bq, Gy, Sv), and basic protection principles (time, distance, shielding). Useful for understanding exposures and safety measures.",
      reference: "IAEA Fundamentals"
    },
    {
      id: 'B3',
      title: 'Nuclear Fuel Cycle',
      content: "A concise guide to mining, enrichment, fuel fabrication, reactor operation, and waste management. Emphasis on where risks arise and how engineering controls reduce them.",
      reference: "OECD / NEA"
    },
    {
      id: 'B4',
      title: 'Repository Engineering',
      content: "Engineering barriers: canisters, buffer materials, and host-rock considerations. Explains design choices used in modern deep geological repositories.",
      reference: "SKB, Posiva"
    },
    {
      id: 'B5',
      title: 'Radiation in Medicine',
      content: "How medical imaging and therapy use radiation safely: dose optimization, ALARA, and clinical trade-offs between diagnostic value and exposure.",
      reference: "WHO / ICRP"
    },
    // User-provided learning modules (inserted categories/books)
    {
      id: 'B6',
      title: 'Half-life (t½) — Concept and Applications',
      content: `Half-life (t½) is a key concept in physics, chemistry, and biology, describing the time it takes for half of a substance to change or be removed. It applies to processes like radioactive decay, chemical reactions, and drug elimination, and can also be extended metaphorically to areas such as advertising effectiveness, electromagnetic radiation, or the decrease of atmospheric pressure with altitude.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B7',
      title: 'Common Misconceptions about Half-Life',
      content: `People have a few common misconceptions regarding half-life:\n\n• Exact Halving: One common misconception is that exactly half of the substance decays after one half-life. The process is probabilistic, meaning the actual amount varies slightly but averages out over many measurements.\n\n• Complete Decay: Some believe that after multiple half-lives, the substance completely disappears. While the amount becomes very small, it never truly reaches zero.\n\n• Constant Rate Misinterpretation: The half-life often gets confused with a constant decay rate. While the decay rate decreases as the amount of the substance decreases, the half-life remains constant for a given substance.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B8',
      title: 'Exponential Decay and Half-Life',
      content: `Half-life relates to exponential decay, a process where the quantity of a substance decreases at a rate proportional to its current value. This is described by:\n\nN(t) = N0 e^{-λ t}\n\nwhere N(t) is the quantity at time t, N0 is the initial quantity, λ is the decay constant, and e is the base of the natural logarithm. The half-life t½ is the time it takes for N(t) to reduce to half of N0. The decay constant λ and the half-life relate by: t½ = ln(2) / λ.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B9',
      title: 'Radioactive Decay — Formulas and Randomness',
      content: `Radioactive decay is a random process at the level of single atoms, governed by the half-life. The decay expression often used is:\n\nN(t) = N0 (1/2)^{t/t½}\n\nwhere N(t) is the quantity at time t, N0 is the initial quantity, and t½ is the half-life. The randomness means decay is probabilistic for individual atoms but predictable in aggregate.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B10',
      title: 'Biological Half-Life — Pharmacology and Toxicology',
      content: `In pharmacology and toxicology, the biological half-life is the time required for a substance, such as a drug, to decrease to half its initial concentration in the body. Unlike radioactive decay, biological half-life is influenced by metabolism, excretion, interactions with other substances, and individual factors such as age, sex, organ function, and overall health, making it less predictable and requiring empirical measurement.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B11',
      title: 'Half-Life in Chemical Kinetics',
      content: `In chemistry, half-life describes the kinetics of reactions and depends on reaction order. For zero-order reactions, the rate is constant and the half-life is given by: t½ = [A]0 / (2 k), where [A]0 is the initial concentration and k is the rate constant. Other reaction orders have different half-life relationships.`,
      reference: 'Science Notes, Chemistry for the Biosciences: The Essential Concepts., Estimating Half-Lives for Pesticide Dissipation from Plants”. Environmental Science & Technology., Modern Physics. Fort Worth: Harcourt Brace Jovanovich., Nuclear and Radiochemistry: Introduction. Vol. 1. Walter de Gruyter.'
    },
    {
      id: 'B12',
      title: 'How Does Nuclear Fission Work?',
      content: `In theory, any atomic nucleus can split apart if it receives enough excitation energy. Fission occurs when the nucleus reaches or exceeds a threshold energy (E_crit). For heavy elements (Z>90) that threshold is typically around 4–6 MeV for even-A nuclei. Thermal neutrons can supply roughly 5 MeV due to binding energy, sufficient to induce fission in many heavy nuclei.`,
      reference: 'Science Notes, Nuclear Chemistry., Nuclear Fission Dynamics: Past, Present, Needs, and Future., Neutrons, Nuclei, and Matter. Mineola, NY: Dover Publications., Spontaneous Emission of Neutrons from Uranium., International Atomic Energy Agency., Stanford University.'
    },
    {
      id: 'B13',
      title: 'Key Facts about Fission and Reactors',
      content: `• Spontaneous fission occurs rarely; neutron-induced fission is controllable and relevant to reactors.\n• Certain isotopes (U-235, U-233, Pu-239) support self-sustaining chain reactions.\n• Fission typically releases two or more neutrons, which can trigger further fissions.\n• A single U-235 fission releases ~210 MeV.\n• To produce 1 W, about 3.1×10^10 fissions per second are required.\n• 1 g of fissile material contains ~2.5×10^21 atoms; full fission could produce ~1 MWd of heat.\n• Historically nuclear energy has contributed around 10% of global electricity (figures vary by year).`,
      reference: 'Science Notes, Nuclear Chemistry., Nuclear Fission Dynamics: Past, Present, Needs, and Future., Neutrons, Nuclei, and Matter. Mineola, NY: Dover Publications., Spontaneous Emission of Neutrons from Uranium., International Atomic Energy Agency., Stanford University.'
    },
    {
      id: 'B14',
      title: 'Natural and Man-Made Radiation — IAEA Overview',
      content: `The International Atomic Energy Agency notes that radioactivity is part of the Earth and has always existed. Naturally occurring radioactive materials are present in the crust, building materials, food, and within our bodies. Cosmic radiation also contributes. Man-made sources include medical X-rays, radiation therapy, fallout from nuclear testing, and small releases from industrial activities.`,
      reference: 'IAEA — Radiation in Everyday Life'
    },
    {
      id: 'B15',
      title: 'Radiation in Daily Life — Examples',
      content: `Radiation in daily life comes from natural sources (cosmic rays, terrestrial isotopes, radon) and man-made sources (medical imaging, airport scanners). Examples include exposure during air travel, building materials, and trace radionuclides in food. Radiation encompasses many forms of energy transfer and is a constant part of the environment.`,
      reference: 'CDC / StudiousGuy summary'
    },
    {
      id: 'B16',
      title: 'What is Radioactive Waste?',
      content: `Radioactive waste refers to materials that are radioactive or contaminated and no longer useful. Classification depends on national policy; radionuclides have half-lives and a mix of emissions. Long-lived radionuclides require isolation over long periods; short-lived often emit penetrating gamma radiation and need shielding.`,
      reference: 'World Nuclear Association'
    },
    {
      id: 'B17',
      title: 'Kinds of Radioactive Waste',
      content: `Common waste categories include:\n• Low-level waste (LLW): low radioactivity, near-surface disposal; ~90% of volume but ~1% of activity.\n• Intermediate-level waste (ILW): higher radioactivity, may require shielding; minimal heat generation.\n• High-level waste (HLW): highly radioactive and thermally hot, requires cooling and heavy shielding; small volume but large fraction of radioactivity.\n• Very low-level and exempt wastes: materials with minimal radioactivity often disposed with ordinary refuse.`,
      reference: 'World Nuclear Association'
    },
    {
      id: 'B18',
      title: 'Advanced Nuclear — Technologies and Trends',
      content: `Advanced nuclear refers to next-generation reactor technologies (molten salt, pebble bed, lead-cooled fast reactors, SMRs) aiming to improve safety, efficiency and cost. The sector has attracted private investment and public policy interest; technologies vary from improved water-cooled designs to non-water fast reactors and prototype fusion concepts.`,
      reference: 'Third Way., U.S Department of Energy.'
    },
    // ... Add/edit modules here using the template above ...
    // ...existing code...
  ],
  // 5. Book Categories: group book IDs into 5 user-facing categories
  // Each category lists the IDs of books from the flat `books` array above.
  bookCategories: [
    { id: 'BK1', title: 'introduction to half-life', bookIds: ['B1','B6','B7','B8','B9','B11'] },
    { id: 'BK2', title: 'understanding nuclear fission', bookIds: ['B3','B12','B13','B18'] },
    { id: 'BK3', title: 'radiation in daily life', bookIds: ['B2','B5','B10','B14','B15'] },
    { id: 'BK4', title: 'safe nuclear waste management', bookIds: ['B4','B16','B17'] },
    { id: 'BK5', title: 'advanced reactor concepts', bookIds: ['B18'] },
  ],
  // 3. Games: Update Titles and Add New Categories
  games: [
    {
      id: 'G1',
      title: 'Half-Life Timer'
    },
    {
      id: 'G2',
      title: 'Radiation Distance calculator'
    },
    {
      id: 'G3',
      title: 'Half-Life Trainer' // Replacement for Myth or Fact Sorter
    },
    {
      id: 'G4',
      title: 'Fission Chain Reaction' // New game
    },
    {
      id: 'G5',
      title: 'Waste Repository Builder' // New game
    }
  ],
};

  // Simple mapping of goals/tasks for each game so the selection screen can show a concise task.
  const gameGoals: Record<string, string> = {
    G1: 'Estimate remaining mass after a number of half-lives (challenge mode available).',
    G2: 'Use distance to observe inverse-square effects and debunk distance myths.',
    G3: 'Calculate remaining mass after N half-lives within tight error bounds to earn a medal.',
    G4: 'Maintain the neutron count within a narrow target range using limited control rods.',
    G5: 'Build all layers in the correct order to complete a multi-barrier repository.',
  };

// SCREENS

// 1. Tap to Start Screen
const OnboardingScreen = ({ onFinish }: { onFinish: () => void }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      color: '#FF6B6B',
      icon: '⭕',
      imageSource: require('./assets/icon1.png'),
      title: 'Clean energy starts with\nnuclear literacy',
    },
    {
      color: '#FFC107',
      icon: '👨‍🔬',
      imageSource: require('./assets/icon2.png'),
      title: 'Explore nuclear science.\nEarn badges.\nLead the board.',
    },
    {
      color: '#2196F3',
      icon: '💪',
      imageSource: require('./assets/icon4.png'),
      title: 'Play, Learn, and Explore\nwith Exciting Quizzes!',
    },
    {
      color: '#4CAF50',
      icon: '🎓',
      imageSource: require('./assets/icon3.jpg'),
      title: 'Welcome to\nCrack the Myth!',
    },
  ];

  const current = slides[currentSlide];

  const goToNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onFinish();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: current.color }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 }}>
        {/* Top Dot */}
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF', marginTop: 20 }} />

        {/* Center Content */}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 }}>
          <View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
            {current.imageSource ? (
              <Image source={current.imageSource} style={{ width: 120, height: 120, borderRadius: 60 }} />
            ) : (
              <Text style={{ fontSize: 80 }}>{current.icon}</Text>
            )}
          </View>

          <Text style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', lineHeight: 36 }}>
            {current.title}
          </Text>
        </View>

        {/* Bottom Navigation Dots */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {slides.map((_, idx) => (
            <View
              key={idx}
              style={{
                width: currentSlide === idx ? 12 : 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: currentSlide === idx ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
              }}
            />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity
          onPress={goToNext}
          style={{
            backgroundColor: '#FFFFFF',
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 20,
            marginBottom: 32,
          }}
        >
          <Text style={{ color: current.color, fontWeight: '700', fontSize: 14 }}>
            {currentSlide === slides.length - 1 ? "Let's Begin!" : 'Next'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const TapToStartScreen = ({ onFinish }: { onFinish: () => void }) => {
  return (
    <Pressable
      onPress={() => onFinish()}
      style={{ width: '100%', alignItems: 'center', justifyContent: 'center', flex: 1, paddingVertical: 40, backgroundColor: '#FFFFFF' }}
    >
      {/* Logo and Title */}
      <View style={{ alignItems: 'center', marginBottom: 24 }}>
        <AppLogo style={{ marginBottom: 24 }} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#00BCC4', marginTop: 16 }}>
          Crack The Myth
        </Text>
        <Text style={{ marginTop: 8, color: '#666', fontSize: 16 }}>
          Debunking Nuclear Misconceptions
        </Text>
      </View>

      {/* Tap to Start */}
      <Animated.View
        style={{
          opacity: 1,
          marginBottom: 100,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#00BCC4', textAlign: 'center' }}>
          Tap the screen to start
        </Text>
      </Animated.View>
    </Pressable>
  );
};

// --- AUTH SCREEN (Login / Signup)
const DEFAULT_BACKEND_URL = 'https://crackthemythapp.onrender.com'; // Render backend URL

const AuthScreen = ({ onLogin, backendUrl, setBackendUrl }: { onLogin: (token: string, user: any) => void; backendUrl: string; setBackendUrl: (u: string) => void }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotEmail, setForgotEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editingServer, setEditingServer] = useState(false);
  const [tmpServer, setTmpServer] = useState(backendUrl || DEFAULT_BACKEND_URL);

  const submit = async () => {
    setMessage(null);
    if (mode === 'signup' && password !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const url = `${backendUrl}/api/auth/${mode === 'signup' ? 'signup' : 'login'}`;
      const body = mode === 'signup' 
        ? { name, email, password }
        : { email, password };
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Auth failed');
      onLogin(data.token, data.user);
    } catch (e: any) {
      setMessage(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  if (showForgotModal) {
    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setShowForgotModal(false); setForgotEmail(''); }} style={{ position: 'absolute', top: 12, right: 12 }}>
            <Text style={{ fontSize: 28, color: '#666', fontWeight: 'bold' }}>×</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>Forgot your Password?</Text>
          <Text style={{ color: '#666', marginBottom: 20, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>Enter your email address and we will share a link to create a new password.</Text>
          <TextInput
            value={forgotEmail}
            onChangeText={setForgotEmail}
            placeholder='Enter Email Address'
            keyboardType='email-address'
            autoCapitalize='none'
            style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#CCC', marginBottom: 20, color: '#333', fontSize: 14 }}
            placeholderTextColor={'#999'}
          />
          <WebButton
            title='► Send'
            onPress={() => { setShowForgotModal(false); setShowResetModal(true); setForgotEmail(''); }}
            style={{ width: '100%', marginBottom: 0 }}
          />
        </View>
      </View>
    );
  }

  if (showResetModal) {
    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => { setShowResetModal(false); setNewPassword(''); setConfirmNewPassword(''); }} style={{ position: 'absolute', top: 12, left: 12 }}>
            <Text style={{ fontSize: 20, color: '#666' }}>‹</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 20, marginTop: 12, textAlign: 'center' }}>Reset password</Text>
          <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: 'left', alignSelf: 'flex-start' }}>Enter New Password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder='New Password'
            secureTextEntry
            style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#00BCC4', marginBottom: 16, color: '#333', fontSize: 14 }}
            placeholderTextColor={'#CCC'}
          />
          <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: 'left', alignSelf: 'flex-start' }}>Confirm New Password</Text>
          <TextInput
            value={confirmNewPassword}
            onChangeText={setConfirmNewPassword}
            placeholder='Re-Enter New Password'
            secureTextEntry
            style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#00BCC4', marginBottom: 20, color: '#333', fontSize: 14 }}
            placeholderTextColor={'#CCC'}
          />
          <WebButton
            title='Submit'
            onPress={() => { setShowResetModal(false); setNewPassword(''); setConfirmNewPassword(''); setMessage('Password reset successfully!'); }}
            style={{ width: '100%', marginBottom: 0 }}
          />
        </View>
      </View>
    );
  }

  if (showResetModal === false && message === 'Password reset successfully!') {
    return (
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320, alignItems: 'center' }}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: '#000', marginBottom: 20 }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 8, textAlign: 'center' }}>Password reset successful!</Text>
          <Text style={{ color: '#666', marginBottom: 20, textAlign: 'center', fontSize: 14 }}>You can now login with your new password.</Text>
          <WebButton
            title='Proceed'
            onPress={() => { setMessage(null); setMode('login'); }}
            style={{ width: '100%' }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1, paddingHorizontal: 24 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 48 }}>
          {/* Logo */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <AppLogo />
          </View>

          {/* Header Text */}
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#00BCC4', marginBottom: 6, textAlign: 'center' }}>
            {mode === 'login' ? 'Welcome Back' : 'Create An Account'}
          </Text>
          <Text style={{ fontSize: 13, color: '#666', marginBottom: 24, textAlign: 'center' }}>
            {mode === 'login' ? 'Login to continue' : 'Sign up to create an account'}
          </Text>

          {/* Form Inputs */}
          <View style={{ width: '100%', marginBottom: 20 }}>
            {mode === 'signup' && (
              <>
                <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Enter Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={'Name'}
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                    marginBottom: 16,
                    color: '#333',
                    fontSize: 14,
                  }}
                  placeholderTextColor={'#999'}
                />
              </>
            )}

            <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Enter Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={'Email'}
              keyboardType='email-address'
              autoCapitalize='none'
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#E0E0E0',
                marginBottom: 16,
                color: '#333',
                fontSize: 14,
              }}
              placeholderTextColor={'#999'}
            />

            <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Enter Password</Text>
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder={'Password'}
                secureTextEntry
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: '#E0E0E0',
                  color: '#333',
                  fontSize: 14,
                }}
                placeholderTextColor={'#CCC'}
              />
              {password && (
                <TouchableOpacity style={{ position: 'absolute', right: 12, top: 12 }}>
                  <Text style={{ fontSize: 18, color: '#999' }}>👁</Text>
                </TouchableOpacity>
              )}
            </View>

            {mode === 'signup' && (
              <>
                <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Confirm Password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder='Re-Enter Password'
                  secureTextEntry
                  style={{
                    width: '100%',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E0E0E0',
                    marginBottom: 20,
                    color: '#333',
                    fontSize: 14,
                  }}
                  placeholderTextColor={'#CCC'}
                />
              </>
            )}
          </View>

          {message ? (
            <Text style={{ color: '#FF6B6B', marginBottom: 16, textAlign: 'center', fontSize: 13, fontWeight: '500' }}>
              {message}
            </Text>
          ) : null}

          {/* Main Button */}
          <TouchableOpacity
            onPress={submit}
            disabled={loading || !email || !password || (mode === 'signup' && !name)}
            style={{
              width: '100%',
              paddingVertical: 14,
              borderRadius: 8,
              backgroundColor: '#00BCC4',
              alignItems: 'center',
              marginBottom: 20,
              opacity: loading || !email || !password || (mode === 'signup' && !name) ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 }}>
              {mode === 'login' ? 'LOG IN' : 'SIGN UP'}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password Link */}
          {mode === 'login' && (
            <TouchableOpacity onPress={() => setShowForgotModal(true)} style={{ marginBottom: 16 }}>
              <Text style={{ color: '#00BCC4', textAlign: 'center', fontSize: 13, fontWeight: '600' }}>
                Forgot Password?
              </Text>
            </TouchableOpacity>
          )}

          {/* Toggle Mode */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#666', fontSize: 13 }}>
              {mode === 'login' ? "Don't have an account? " : 'Have an account? '}
            </Text>
            <TouchableOpacity onPress={() => setMode(m => m === 'login' ? 'signup' : 'login')}>
              <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '700' }}>
                {mode === 'login' ? 'Sign up now' : 'Log in'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Server selection: allow changing backend when login fails or for testing */}
          <View style={{ width: '100%', marginTop: 12 }}>
            {editingServer ? (
              <View style={{ width: '100%' }}>
                <Text style={{ color: '#00BCC4', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Server</Text>
                <TextInput
                  value={tmpServer}
                  onChangeText={setTmpServer}
                  placeholder={'http://192.168.254.100:4000'}
                  style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', marginBottom: 12, color: '#333', fontSize: 14 }}
                  placeholderTextColor={'#999'}
                  autoCapitalize='none'
                />
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                  <TouchableOpacity onPress={() => { setBackendUrl(tmpServer); setEditingServer(false); }} style={{ flex: 1, backgroundColor: '#00BCC4', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setTmpServer(backendUrl || DEFAULT_BACKEND_URL); setEditingServer(false); }} style={{ flex: 1, backgroundColor: '#E5E7EB', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#333', fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setTmpServer(DEFAULT_BACKEND_URL); setBackendUrl(DEFAULT_BACKEND_URL); setEditingServer(false); }} style={{ flex: 1, backgroundColor: '#F97316', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Reset</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: '#666', fontSize: 13 }}>Server: {backendUrl}</Text>
                <TouchableOpacity onPress={() => setEditingServer(true)}>
                  <Text style={{ color: '#00BCC4', fontWeight: '700' }}>Change</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// 2. Main Menu Screen
type MainMenuProps = {
  setScreen: (screen: string) => void;
  setItem: (item: any) => void;
};

const MainMenu = ({ setScreen, setItem }: MainMenuProps) => {
  const [logoMoved, setLogoMoved] = useState(false);
  useEffect(() => {
    setTimeout(() => setLogoMoved(true), 100);
  }, []);
  const handlePress = (category: string) => {
    setScreen(`${category}_select`);
  };
  return (
    <CenteredScreen outerStyle={{ backgroundColor: colors.background }}>
      {/* Animated Logo at the top */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 32, left: 0, right: 0, alignItems: 'center', opacity: logoMoved ? 1 : 0 }}>
        <AppLogo style={{}} />
      </View>
      {/* Main Menu Options */}
      <View style={{ width: '100%', maxWidth: 400, paddingTop: 80, opacity: logoMoved ? 1 : 0 }}>
        <View style={{ alignItems: 'center', marginBottom: 32, paddingTop: 16, borderBottomWidth: 1, borderBottomColor: '#FFB300', paddingBottom: 8 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text }}>Select Your Zone</Text>
        </View>
        <WebButton
          title="Quizzes (5 Categories)"
          iconChar={ICONS.Brain}
          onPress={() => handlePress('quiz')}
          style={{ marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: colors.accent }}
          textColor={colors.text}
        />
        <WebButton
          title="Mini-Games (5)"
          iconChar={ICONS.Gamepad2}
          onPress={() => handlePress('game')}
          style={{ marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: colors.accent }}
          textColor={colors.text}
        />
        <WebButton
          title="Learning Modules (5)"
          iconChar={ICONS.BookOpen}
          onPress={() => setScreen('book_categories')}
          style={{ marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: colors.accent }}
          textColor={colors.text}
        />
        {/* 1. Add Achievements Button */}
        <WebButton
          title="Achievements"
          iconChar={ICONS.Medal}
          onPress={() => setScreen('achievements')}
          style={{ marginVertical: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: colors.accent }}
          textColor={colors.text}
        />
      </View>
    </CenteredScreen>
  );
};

// Extend main menu with profile-aware variant below. We'll keep the original `MainMenu` for compatibility but
// render a profile-aware menu when `user` is passed in at runtime.
type MainMenuProps2 = {
  setScreen: (screen: string) => void;
  setItem: (item: any) => void;
  user?: any;
  logout?: () => void;
  achievements?: any;
};

const MainMenuWithProfile = ({ setScreen, setItem, user, logout, achievements = { stars: {}, medals: {} }, initialTab }: MainMenuProps2 & { initialTab?: string }) => {
  const [activeTab, setActiveTab] = useState(initialTab || 'home');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [expandedQuizzesId, setExpandedQuizzesId] = useState<string | null>(null);
  const [expandedModulesId, setExpandedModulesId] = useState<string | null>(null);
  // Track completed books: { bookId: true, ... }
  const [completedBooks, setCompletedBooks] = useState<Record<string, boolean>>({});

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Reset expanded states when switching tabs
    if (tabId !== 'quizzes') setExpandedQuizzesId(null);
    if (tabId !== 'modules') setExpandedModulesId(null);
  };

  const toggleQuiz = (quizId: string) => {
    console.log(`Before toggle: expandedQuizzesId=${expandedQuizzesId}, clicking=${quizId}`);
    setExpandedQuizzesId(prev => {
      const newId = prev === quizId ? null : quizId;
      console.log(`After toggle: was ${prev}, now ${newId}`);
      return newId;
    });
  };

  const toggleModule = (moduleId: string) => {
    console.log(`Before toggle: expandedModulesId=${expandedModulesId}, clicking=${moduleId}`);
    setExpandedModulesId(prev => {
      const newId = prev === moduleId ? null : moduleId;
      console.log(`After toggle: was ${prev}, now ${newId}`);
      return newId;
    });
  };
  const renderTabBar = () => {
    const tabs = [
      { id: 'home', icon: '🏠', label: 'Home', color: '#FFFFFF' },
      { id: 'modules', icon: '📚', label: 'Module', color: '#FFFFFF' },
      { id: 'games', icon: '🎮', label: 'Games', color: '#FFFFFF' },
      { id: 'quizzes', icon: '🧠', label: 'Quizzes', color: '#FFFFFF' },
      { id: 'profile', icon: '👤', label: 'Profile', color: '#FFFFFF' },
    ];

    const getTabColor = (tabId: string) => {
      switch(tabId) {
        case 'home': return '#0066FF';
        case 'modules': return '#00CC88';
        case 'games': return '#9933FF';
        case 'quizzes': return '#FFB300';
        case 'profile': return '#FF6B5B';
        default: return '#000000';
      }
    };

    return (
      <View style={{ flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 8, paddingHorizontal: 4, borderTopWidth: 1, borderTopColor: '#E0E0E0' }}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const bgColor = getTabColor(tab.id);
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => handleTabChange(tab.id)}
              style={{ 
                flex: 1, 
                alignItems: 'center', 
                paddingVertical: 12,
                backgroundColor: isActive ? bgColor : 'transparent',
                borderRadius: 12,
                marginHorizontal: 2
              }}
            >
              <Text style={{ fontSize: 20, marginBottom: 4, opacity: isActive ? 1 : 0.5 }}>{tab.icon}</Text>
              <Text style={{ fontSize: 10, color: isActive ? '#FFFFFF' : '#666', fontWeight: isActive ? '700' : '500' }}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // HOME TAB - Quizzes, Games, and Learning Modules
  const renderHomeTab = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}>
          {/* Header */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <AppLogo />
          </View>

          {/* Welcome */}
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF', marginBottom: 4, textAlign: 'center' }}>
            Hello, {user && user.name ? user.name : 'User'}!
          </Text>
          <Text style={{ fontSize: 13, color: '#333', marginBottom: 24, textAlign: 'center' }}>
            Welcome to Crack the Myth
          </Text>

          {/* Quick Stats */}
          <View style={{ backgroundColor: '#E6F0FF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>Quick Stats</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Games Played</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF' }}>{Object.keys(achievements.medals || {}).length}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Quizzes Done</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF' }}>{Object.keys(achievements.stars || {}).length}</Text>
              </View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Modules Read</Text>
                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF' }}>0</Text>
              </View>
            </View>
          </View>

          {/* Navigation Info */}
          <View style={{ backgroundColor: '#FFF9E6', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FFE680' }}>
            <Text style={{ fontSize: 13, color: '#333', lineHeight: 20 }}>Use the tabs below to navigate to Games, Quizzes, Learning Modules, and your Profile to track achievements!</Text>
          </View>
        </ScrollView>
        {renderTabBar()}
      </SafeAreaView>
    </View>
  );

  // MODULE TAB - Learning Modules/Books
  const renderModuleTab = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between' }}>
        {/* Header with Green Background and Large Character */}
        <View style={{ position: 'relative', height: 240, backgroundColor: '#FFFFFF'}}>
          {/* Green Background Image */}
          <Image
            source={require('./assets/green.png')}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100%',
              height: '100%',
              resizeMode: 'cover',
            }}
          />

          {/* Content: Title on left - positioned lower */}
          <View style={{ position: 'absolute', top: 50, left: 27, zIndex: 10 }}>
            <Text style={{ fontSize: 28, fontWeight: '700', color: '#000000ff', marginBottom: 4, lineHeight: 32 }}>
              Hello, {user && user.name ? user.name : 'User'}!
            </Text>
            <Text style={{ fontSize: 16, fontWeight: '500', color: 'rgba(0, 0, 0, 0.95)', lineHeight: 20 }}>
              Welcome to Learning Lab
            </Text>
          </View>

          {/* Large Character Image - positioned to right side and bottom */}
          <View style={{ position: 'absolute', bottom: -50, right: -20, zIndex: 5 }}>
            <Image
              source={require('./assets/character1.png')}
              style={{ width: 270, height: 270, resizeMode: 'contain' }}
            />
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, paddingBottom: 40, marginTop: -8 }}>
          {/* Display Learning Module Categories */}
          {appData.bookCategories && appData.bookCategories.length > 0 ? (
            appData.bookCategories.map((cat: any, catIdx: number) => {
              const expanded = expandedModulesId === cat.id;
              
              // Calculate progress: completed books / total books
              const totalBooks = (cat.bookIds || []).length;
              const completedCount = (cat.bookIds || []).filter((bId: string) => completedBooks[bId]).length;
              const progressPercent = totalBooks > 0 ? (completedCount / totalBooks) * 100 : 0;

              // Gradient colors for each module category
              const gradientColors: Record<string, { start: string; end: string }> = {
                BK1: { start: '#66BB6A', end: '#EF9A9A' }, // green to pink
                BK2: { start: '#66BB6A', end: '#EF9A9A' }, // blue to purple
                BK3: { start: '#66BB6A', end: '#EF9A9A' }, // orange to red
                BK4: { start: '#66BB6A', end: '#EF9A9A' }, // purple to yellow
                BK5: { start: '#66BB6A', end: '#EF9A9A' }, // cyan to green
              };
              const colors = gradientColors[cat.id] || { start: '#66BB6A', end: '#EF9A9A' };

              return (
                <View key={`module-cat-${cat.id}-${catIdx}`} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => toggleModule(cat.id)}
                    style={{
                      borderRadius: 12,
                      padding: 14,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      backgroundColor: colors.start,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Gradient overlay effect - simple color blend */}
                    <View style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: '50%',
                      height: '100%',
                      backgroundColor: colors.end,
                      opacity: 0.3,
                      borderRadius: 12,
                    }} />

                    <View style={{ flex: 1, zIndex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>{cat.title}</Text>
                    </View>

                    {/* Progress Circle */}
                    <View style={{ alignItems: 'center', marginHorizontal: 12, zIndex: 1 }}>
                      <View style={{
                        width: 50,
                        height: 50,
                        borderRadius: 25,
                        backgroundColor: 'rgba(255,255,255,0.9)',
                        justifyContent: 'center',
                        alignItems: 'center',
                        borderWidth: 2,
                        borderColor: '#FFFFFF',
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>
                          {completedCount}/{totalBooks}
                        </Text>
                      </View>
                    </View>

                    {/* Arrow */}
                    <Text style={{ fontSize: 18, color: '#000', fontWeight: '700', zIndex: 1 }}>{expanded ? '▼' : '▶'}</Text>
                  </TouchableOpacity>
                  {expanded && (
                    <View style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, backgroundColor: '#F5F5F5', borderRadius: 8, marginTop: 8 }}>
                      {(cat.bookIds || []).map((bookId: string, bIdx: number) => {
                        const book = appData.books.find((b: any) => b.id === bookId);
                        if (!book) return null;
                        const isCompleted = completedBooks[bookId];

                        return (
                          <TouchableOpacity
                            key={`book-${bookId}-${bIdx}`}
                            onPress={() => {
                              setItem(book);
                              setScreen(`book_run_${bookId}`);
                              // Mark as completed when user opens the book (you may want to track completion differently)
                              // setCompletedBooks(s => ({ ...s, [bookId]: true }));
                            }}
                            style={{ backgroundColor: isCompleted ? '#E8F5E9' : '#FFF9E6', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: isCompleted ? '#4CAF50' : '#FFE680' }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontWeight: '700', color: '#000', fontSize: 15, flex: 1 }}>{book.title}</Text>
                              {isCompleted && <Text style={{ fontSize: 18, marginLeft: 8, color: '#000' }}>✓</Text>}
                            </View>
                            <Text style={{ fontSize: 12, color: '#000', marginTop: 4 }}>{book.reference || 'Learning Module'}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 16, color: '#000' }}>No learning modules available</Text>
            </View>
          )}
        </ScrollView>
        {renderTabBar()}
      </SafeAreaView>
    </View>
  );

  // GAMES TAB - All Games
  const renderGamesTab = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF', marginBottom: 4, textAlign: 'center' }}>
            Hello, {user && user.name ? user.name : 'User'}!
          </Text>
          <Text style={{ fontSize: 13, color: '#333', marginBottom: 24, textAlign: 'center' }}>
            Choose a game to play
          </Text>

          {/* Games Container */}
          {Array.isArray(appData.games) && appData.games.length > 0 ? (
            appData.games.map((g: any, idx: number) => (
              <View key={`game-${g.id}-${idx}`} style={{ marginBottom: 12 }}>
                <WebButton
                  title={g.title}
                  onPress={() => { setItem(g); setScreen(`game_run_${g.id}`); }}
                  imageSrc={g.image}
                  style={{ backgroundColor: '#E6F0FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12 }}
                  textColor={'#000'}
                />
                <Text style={{ fontSize: 12, color: '#666', marginTop: 6 }}>{gameGoals[g.id] || ''}</Text>
              </View>
            ))
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 16, color: '#999' }}>No games available</Text>
            </View>
          )}
        </ScrollView>
        {renderTabBar()}
      </SafeAreaView>
    </View>
  );

  // QUIZZES TAB - All Quizzes
  const renderQuizzesTab = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0066FF', marginBottom: 4, textAlign: 'center' }}>
            Hello, {user && user.name ? user.name : 'User'}!
          </Text>
          <Text style={{ fontSize: 13, color: '#333', marginBottom: 24, textAlign: 'center' }}>
            Take a quiz challenge
          </Text>

          {/* Quizzes Container */}
          {Array.isArray(appData.quizzes) && appData.quizzes.length > 0 ? (
            appData.quizzes.map((cat: any, catIdx: number) => {
              const expanded = expandedQuizzesId === cat.id;
              console.log(`Quiz ${cat.id}: expanded=${expanded}, expandedQuizzesId=${expandedQuizzesId}`);
              return (
                <View key={`quiz-cat-${cat.id}-${catIdx}`} style={{ marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => toggleQuiz(cat.id)}
                    style={{ backgroundColor: '#E6F3FF', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#0066FF' }}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#000' }}>{cat.title}</Text>
                      <Text style={{ fontSize: 16, color: '#0066FF', fontWeight: 'bold' }}>{expanded ? '▼' : '▶'}</Text>
                    </View>
                  </TouchableOpacity>
                  {expanded && (
                    <View style={{ marginTop: 8, paddingLeft: 12, paddingRight: 12, paddingBottom: 12, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', borderTopWidth: 0 }}>
                      {['E','M','H'].map((d, dIdx) => {
                        const lvl = (cat.levels || []).find((l: any) => new RegExp(`-${d}$`).test(l.id));
                        if (!lvl) return null;
                        const label = d === 'E' ? 'Easy' : d === 'M' ? 'Medium' : 'Hard';
                        const lvlStars = achievements.stars[lvl.id] || 0;
                        return (
                          <TouchableOpacity
                            key={`level-${lvl.id}-${dIdx}`}
                            onPress={() => { setItem(lvl); setScreen(`quiz_run_${lvl.id}`); }}
                            style={{ backgroundColor: '#FFF9E6', borderRadius: 10, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: '#FFE680' }}
                          >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Text style={{ fontWeight: '700', color: '#000' }}>{label}</Text>
                              <Text style={{ fontSize: 12, color: '#FFD700' }}>{'⭐'.repeat(lvlStars) || '-'}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <Text style={{ fontSize: 16, color: '#999' }}>No quizzes available</Text>
            </View>
          )}
        </ScrollView>
        {renderTabBar()}
      </SafeAreaView>
    </View>
  );

  // PROFILE TAB - User Stats and Achievements
  const renderProfileTab = () => (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 }}>
          {/* Avatar Section */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#E6F0FF', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 48 }}>👤</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#0066FF', textAlign: 'center' }}>
              {user && user.name ? user.name : 'User'}
            </Text>
          </View>

          {/* Stats Grid */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#E6F0FF', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Time Spent</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#0066FF' }}>
                {Math.floor((user?.stats?.totalTime || 0) / 60)}m
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#E6F0FF', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Attempts</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#0066FF' }}>
                {user?.stats?.totalAttempts || 0}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#E6F0FF', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>Completed</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#0066FF' }}>
                {user?.stats?.quizzesCompleted || 0}
              </Text>
            </View>
          </View>

          {/* User Info */}
          <View style={{ backgroundColor: '#E6F0FF', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8 }}>Email</Text>
            <Text style={{ fontSize: 14, color: '#000', fontWeight: '500', marginBottom: 16 }}>{user?.email}</Text>

            <Text style={{ fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8 }}>Member Since</Text>
            <Text style={{ fontSize: 14, color: '#000', fontWeight: '500' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </Text>
          </View>

          {/* Quiz Stars */}
          {appData.quizzes && appData.quizzes.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>Quiz Achievements</Text>
              {appData.quizzes.map((cat: any, catIdx: number) => {
                const eLevel = cat.levels?.find((l: any) => l.id.endsWith('-E'));
                const mLevel = cat.levels?.find((l: any) => l.id.endsWith('-M'));
                const hLevel = cat.levels?.find((l: any) => l.id.endsWith('-H'));
                const eStar = achievements.stars[eLevel?.id] || 0;
                const mStar = achievements.stars[mLevel?.id] || 0;
                const hStar = achievements.stars[hLevel?.id] || 0;
                return (
                  <View key={`quiz-ach-${cat.id}-${catIdx}`} style={{ backgroundColor: '#E6F3FF', borderRadius: 12, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#0066FF' }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 8 }}>{cat.title}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Easy</Text>
                        <Text style={{ fontSize: 16, color: '#FFD700' }}>{eStar > 0 ? '⭐'.repeat(eStar) : '-'}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Medium</Text>
                        <Text style={{ fontSize: 16, color: '#FFD700' }}>{mStar > 0 ? '⭐'.repeat(mStar) : '-'}</Text>
                      </View>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Hard</Text>
                        <Text style={{ fontSize: 16, color: '#FFD700' }}>{hStar > 0 ? '⭐'.repeat(hStar) : '-'}</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Game Medals */}
          {appData.games && appData.games.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: '#000', marginBottom: 12 }}>Game Achievements</Text>
              {appData.games.map((game: any, gameIdx: number) => {
                const medal = achievements.medals[game.id];
                return (
                  <View key={`game-ach-${game.id}-${gameIdx}`} style={{ backgroundColor: '#FFF9E6', borderRadius: 12, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#FFD700' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>{game.title}</Text>
                      <Text style={{ fontSize: 20, color: '#FFD700' }}>{medal ? '🏅' : '⭕'}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Logout Button */}
          {logout && (
            <TouchableOpacity
              onPress={() => logout()}
              style={{
                backgroundColor: '#000',
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Log Out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
        {renderTabBar()}
      </SafeAreaView>
    </View>
  );

  // Render appropriate tab
  return (
    <>
      {activeTab === 'home' && renderHomeTab()}
      {activeTab === 'modules' && renderModuleTab()}
      {activeTab === 'games' && renderGamesTab()}
      {activeTab === 'quizzes' && renderQuizzesTab()}
      {activeTab === 'profile' && renderProfileTab()}
    </>
  );
};

// --- NEW COMPONENT: Quiz Category Selection ---
type QuizData = typeof appData.quizzes[0];
type QuizLevel = QuizData['levels'][0];

const QuizCategoryScreen = ({ setScreen, setItem }: Pick<MainMenuProps, 'setScreen' | 'setItem'>) => {
  const quizCategories = appData.quizzes;
  const theme = { title: 'QUIZ ZONE', color: 'cyan', iconChar: ICONS.Brain };
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const renderCategory = (category: QuizData) => {
    const isExpanded = expandedId === category.id;
    return (
      <View key={category.id} style={{ width: '100%', marginVertical: 8 }}>
        <TouchableOpacity 
          onPress={() => setExpandedId(isExpanded ? null : category.id)}
          style={{ backgroundColor: '#E6F3FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#0066FF' }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000' }}>{category.title}</Text>
            <Text style={{ fontSize: 16, color: '#0066FF', fontWeight: 'bold' }}>{isExpanded ? '▼' : '▶'}</Text>
          </View>
        </TouchableOpacity>
        {isExpanded && (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 0, padding: 12, borderWidth: 1, borderColor: '#0066FF', borderTopWidth: 0 }}>
            {category.levels.map(level => (
              <WebButton
                key={level.id}
                title={`${level.title} (${level.questions.length} Qs)`}
                iconChar={theme.iconChar}
                onPress={() => {
                  // The selected item is the specific level (e.g., QZ1-E)
                  setItem(level);
                  setScreen(`quiz_run_${level.id}`);
                }}
                style={{ backgroundColor: '#E6F3FF', borderWidth: 1, borderColor: '#0066FF', marginVertical: 4 }}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ maxWidth: Math.min(CONTENT_MAX_WIDTH, 440) }}>
      <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF' }}>{theme.title}</Text>
      </View>
      {/* Make category list scrollable */}
      <ScrollView contentContainerStyle={{ paddingBottom: 16, paddingTop: 10, width: '100%' }} style={{ maxHeight: 500, width: '100%' }}>
        {quizCategories.map(renderCategory)}
      </ScrollView>
      <WebButton
        title="Back to Main Menu"
        iconChar={ICONS.Back}
        onPress={() => setScreen('main')}
        style={{ width: '100%', backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF', marginTop: 12 }}
      />
    </CenteredScreen>
  );
};
// --- END NEW COMPONENT ---

// --- Profile Screen ---
const ProfileScreen = ({ user, achievements, logout, setScreen }: { user: any; achievements: any; logout?: () => void; setScreen: (s: string) => void }) => {
  if (!user) return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ color: '#666', fontSize: 16 }}>Not logged in.</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24 }}>
          {/* Avatar Section */}
          <View style={{ alignItems: 'center', marginBottom: 24 }}>
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#90EE90', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 48 }}>👤</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#00BCC4', textAlign: 'center' }}>
              {user?.name || 'User'}
            </Text>
          </View>

          {/* Stats Cards Grid */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Time Spent</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#00BCC4' }}>{Math.floor((user?.stats?.totalTime || 0) / 60)}m</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Attempts</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#00BCC4' }}>{user?.stats?.totalAttempts || 0}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>Completed</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#00BCC4' }}>{user?.stats?.quizzesCompleted || 0}</Text>
            </View>
          </View>

          {/* User Info */}
          <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 8 }}>Email</Text>
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500', marginBottom: 16 }}>{user?.email}</Text>
            
            <Text style={{ fontSize: 13, fontWeight: '600', color: '#999', marginBottom: 8 }}>Member Since</Text>
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Recently'}
            </Text>
          </View>

          {/* Achievements Section */}
          <View style={{ backgroundColor: '#F5F5F5', borderRadius: 12, padding: 16, marginBottom: 24 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#333', marginBottom: 12 }}>Recent Achievements</Text>
            {achievements && Object.keys(achievements).length > 0 ? (
              <View>
                <Text style={{ fontSize: 12, color: '#666', lineHeight: 18 }}>
                  {JSON.stringify(achievements, null, 2).slice(0, 200)}...
                </Text>
              </View>
            ) : (
              <Text style={{ fontSize: 12, color: '#999' }}>No achievements yet. Start quizzing to earn badges!</Text>
            )}
          </View>

          {/* Logout Button */}
          {logout && (
            <TouchableOpacity
              onPress={() => logout()}
              style={{
                backgroundColor: '#FF6B6B',
                borderRadius: 8,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Log Out</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

// --- NEW COMPONENT: Book Category Selection ---
const BookCategoryScreen = ({ setScreen, setItem }: Pick<MainMenuProps, 'setScreen' | 'setItem'>) => {
  const categories = appData.bookCategories || [];

  const renderCategory = (cat: { id: string; title: string; bookIds: string[] }) => (
    <View key={cat.id} style={{ width: '100%', marginVertical: 8 }}>
      <View style={{ backgroundColor: '#E6F3FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#0066FF' }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#000000', marginBottom: 8 }}>{cat.title}</Text>
        {cat.bookIds.map(bid => {
          const book = appData.books.find((b: any) => b.id === bid);
          if (!book) return null;
          return (
            <WebButton
              key={bid}
              title={book.title}
              onPress={() => { setItem(book); setScreen(`book_run_${bid}`); }}
              style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0066FF', marginVertical: 4 }}
            />
          );
        })}
      </View>
    </View>
  );

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ maxWidth: Math.min(CONTENT_MAX_WIDTH, 640) }}>
      <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF' }}>Learning Modules</Text>
        <Text style={{ fontSize: 14, color: '#666666', marginTop: 6 }}>Choose a category, then a module to read.</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 16, paddingTop: 10, width: '100%' }} style={{ maxHeight: 560, width: '100%' }}>
        {categories.map(renderCategory)}
      </ScrollView>
      <WebButton
        title="Back to Main Menu"
        iconChar={ICONS.Back}
        onPress={() => setScreen('main')}
        style={{ width: '100%', backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF', marginTop: 12 }}
      />
    </CenteredScreen>
  );
};
// --- END NEW COMPONENT ---

// 3. Selection Screens (Game, Book)
type SelectionScreenProps = {
  category: 'game' | 'book'; // Quiz selection handled by new component
  setScreen: (screen: string) => void;
  setItem: (item: any) => void;
};

const SelectionScreen = ({ category, setScreen, setItem }: SelectionScreenProps) => {
  const categoryMap = {
    book: 'books',
    game: 'games',
  } as const;
  const data = appData[categoryMap[category]];

  const getCategoryTheme = () => {
    switch (category) {
      case 'game': return { title: 'GAME ZONE', color: 'green', iconChar: ICONS.Gamepad2 };
      case 'book': return { title: 'LEARNING ZONE', color: 'orange', iconChar: ICONS.BookOpen };
      default: return { title: 'SELECTION', color: 'gray', iconChar: ICONS.Brain };
    }
  };
  const theme = getCategoryTheme();

  const renderItem = (item: { id: string; title: string }) => (
    <View key={item.id} style={{ width: '100%', marginVertical: 8 }}>
      {category === 'game' ? (
        // For games: render a compact button + concise task/goal (no large card container)
        <View style={{ width: '100%' }}>
          <WebButton
            title={item.title}
            iconChar={theme.iconChar}
            imageSrc={(item as any).image}
            onPress={() => {
              setItem(item);
              setScreen(`${category}_run_${item.id}`);
            }}
            style={{ width: '100%', backgroundColor: '#E6F0FF', marginBottom: 6, borderWidth: 1, borderColor: '#0066FF' }}
          />
          <Text style={{ color: '#666666', fontSize: 13, marginTop: 4 }}>{gameGoals[item.id] ?? ''}</Text>
        </View>
      ) : (
        <View style={{ backgroundColor: '#E6F3FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#0066FF' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#000000', marginBottom: 8 }}>{item.title}</Text>
          <WebButton
            title={`Open ${item.title}`}
            iconChar={theme.iconChar}
            onPress={() => {
              setItem(item);
              setScreen(`${category}_run_${item.id}`);
            }}
            style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#0066FF' }}
          />
        </View>
      )}
    </View>
  );

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ maxWidth: Math.min(CONTENT_MAX_WIDTH, 440) }}>
      <View style={{ alignItems: 'center', marginBottom: 20, marginTop: 20 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#0066FF' }}>{theme.title}</Text>
      </View>
      {/* Use a ScrollView for the list of items to ensure scrollability */}
      <ScrollView contentContainerStyle={{ paddingBottom: 16, paddingTop: 10 }} style={{ maxHeight: 500, width: '100%' }}>
        {data.map(renderItem)}
      </ScrollView>
      <WebButton
        title="Back to Main Menu"
        iconChar={ICONS.Back}
        onPress={() => setScreen('main')}
        style={{ width: '100%', backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF', marginTop: 12 }}
      />
    </CenteredScreen>
  );
};

// 4. Content Screens

// 4a. Quiz Runner
type QuizItem = {
  id: string;
  title: string;
  questions: {
    q: string;
    a: string;
    options: string[];
    explanation: string;
  }[];
};

const QuizRunner = ({ item, setScreen, onComplete }: { item: QuizItem; setScreen: (screen: string) => void; onComplete?: (levelId: string, score: number) => void }) => {
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [message, setMessage] = useState<React.ReactNode>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const question = item.questions[currentQ];

  // Lower background music volume while quiz is active so correct/incorrect sounds are audible.
  useEffect(() => {
    let prevVol = 1;
    (async () => {
      try {
        const cur = await SoundManager.getBackgroundVolume();
        if (typeof cur === 'number') prevVol = cur;
        await SoundManager.setBackgroundVolume(0.25);
      } catch (e) {}
    })();

    return () => {
      (async () => {
        try { await SoundManager.setBackgroundVolume(prevVol); } catch (e) {}
      })();
    };
  }, []);

  const handleAnswer = (answer: string) => {
    if (showResult) return;

    setSelectedOption(answer);
    if (answer === question.a) {
      setScore(s => s + 1);
      try { SoundManager.play('correct'); } catch (e) {}
      setMessage(
        <Text style={{ fontSize: 14, color: '#000000', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, color: '#16a34a', marginRight: 6 }}>{ICONS.Check}</Text>
          <Text style={{ fontWeight: '700' }}>Correct!</Text>
          <Text>{` ${question.explanation}`}</Text>
        </Text>
      );
    } else {
      try { SoundManager.play('incorrect'); } catch (e) {}
      setMessage(
        <Text style={{ fontSize: 14, color: '#000000', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, color: '#ef4444', marginRight: 6 }}>{ICONS.X}</Text>
          <Text style={{ fontWeight: '700' }}>Incorrect.</Text>
          <Text>{` The correct answer is ${question.a}. ${question.explanation}`}</Text>
        </Text>
      );
    }

    setShowResult(true);
  };

  const nextQuestion = () => {
    setShowResult(false);
    setMessage(null);
    setSelectedOption(null);
    if (currentQ < item.questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setIsFinished(true);
    }
  };

  // Notify parent when the quiz becomes finished
  useEffect(() => {
    if (isFinished) {
      try { if (onComplete) onComplete(item.id, score); } catch (e) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFinished]);

  if (isFinished) {
    // Determine the title from the level ID for the summary screen
    const levelTitleMatch = item.id.match(/-([E|M|H])$/);
    const levelTitle = levelTitleMatch ? `${item.title.split(' ')[0]} - ${levelTitleMatch[1] === 'E' ? 'Easy' : levelTitleMatch[1] === 'M' ? 'Medium' : 'Hard'}` : item.title;

    return (
      <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }}>
        <View style={{ padding: 20, backgroundColor: '#E6F3FF', borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', alignSelf: 'center', maxWidth: 500 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#FFD700', textAlign: 'center', marginBottom: 8 }}>Quiz Complete!</Text>
          <Text style={{ fontSize: 18, textAlign: 'center', color: '#000000', marginBottom: 16 }}>
            <Text style={{ fontWeight: '700' }}>{levelTitle} Score: </Text>
            <Text style={{ color: '#FFD700', fontWeight: '900' }}>{score}</Text>
            <Text>{` out of ${item.questions.length}`}</Text>
          </Text>
          <WebButton
            title="Try Again"
            onPress={() => {
              setScore(0);
              setCurrentQ(0);
              setIsFinished(false);
            }}
            style={{ width: '100%', marginVertical: 6, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }}
          />
          <WebButton
            title="Back to Quizzes"
            iconChar={ICONS.Back}
            onPress={() => setScreen('main')}
            style={{ width: '100%', marginTop: 6, backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700' }}
          />
        </View>
      </CenteredScreen>
    );
  }

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF', justifyContent: 'flex-start', paddingTop: 20 }} innerStyle={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignItems: 'stretch', justifyContent: 'flex-start', flex: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800', color: '#000000', textAlign: 'center', marginTop: 12, marginBottom: 8 }}>{item.title}</Text>
        <Text style={{ fontSize: 16, color: '#0066FF', textAlign: 'center', marginBottom: 12 }}>{`Question ${currentQ + 1}/${item.questions.length}`}</Text>

        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#0066FF' }}>
          <Text style={{ fontSize: 16, color: '#000000', fontWeight: '700' }}>{question.q}</Text>
        </View>

        <View style={{ marginBottom: 12 }}>
          {question.options.map((option, index) => {
            const isCorrect = showResult && option === question.a;
            const isSelectedWrong = showResult && option === selectedOption && option !== question.a;

            let bgColor = '#E6F3FF';
            let textColor = '#000000';
            let iconChar: string | null = null;

            if (isCorrect) {
              bgColor = '#FFD700';
              textColor = '#000000';
              iconChar = ICONS.Check;
            } else if (isSelectedWrong) {
              bgColor = '#FF6B6B';
              textColor = '#FFFFFF';
              iconChar = ICONS.X;
            } else {
              bgColor = '#E6F3FF';
              textColor = '#000000';
            }

            return (
              <Pressable
                key={index}
                onPress={() => handleAnswer(option)}
                disabled={showResult}
                style={{ paddingVertical: 12, paddingHorizontal: 14, borderRadius: 10, marginBottom: 8, backgroundColor: bgColor, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: isCorrect ? '#FFD700' : isSelectedWrong ? '#FF6B6B' : '#0066FF' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {iconChar && (
                    <Text style={{ fontSize: 18, marginRight: 8, color: textColor }}>{iconChar}</Text>
                  )}
                  <Text style={{ color: textColor, fontWeight: '700' }}>{option}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {showResult && (
          <View style={{ backgroundColor: '#E6F3FF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#0066FF' }}>
            <WebButton title="Continue" onPress={nextQuestion} style={{ width: '100%', backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
          </View>
        )}
    </CenteredScreen>
  );
};

// 4b. Book Runner (Now Scrollable inside the parent ScrollView)
type BookItem = {
  id: string;
  title: string;
  content: string;
  reference: string;
};

const BookRunner = ({ item, setScreen }: { item: BookItem; setScreen: (screen: string) => void }) => {
  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Curved Green Header with Title */}
        <View style={{ height: 180, backgroundColor: '#66BB6A', overflow: 'hidden' }}>
          <Image 
            source={require('./assets/green2.png')} 
            style={{ width: '100%', height: '100%', resizeMode: 'cover' }} 
          />
          <Text 
            style={{ 
              position: 'absolute', 
              top: 80, 
              left: 24, 
              fontSize: 20, 
              fontWeight: '800', 
              color: '#000000ff',
              right: 24,
              lineHeight: 36
            }}
          >
            {item.title}
          </Text>
        </View>

        {/* Scrollable Content Area */}
        <ScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 24, paddingBottom: 40 }}
        >
          <Text style={{ fontSize: 16, color: '#000000', lineHeight: 26 }}>{item.content}</Text>
          <Text style={{ fontSize: 12, color: '#666666', marginTop: 20 }}>{`Source References: ${item.reference}`}</Text>
        </ScrollView>

        {/* Back Button at Bottom */}
        <View style={{ alignItems: 'center', paddingVertical: 16, paddingBottom: 24 }}>
          <TouchableOpacity 
            onPress={() => setScreen('main_modules')} 
            style={{ 
              backgroundColor: '#66BB6A', 
              paddingHorizontal: 32, 
              paddingVertical: 10, 
              borderRadius: 24 
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 16 }}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

// 4c. Game Runners

// Game 1: Half-Life Timer (Unchanged)
const HalfLifeTimer = ({ setScreen }: { setScreen: (screen: string) => void }) => {
  const [material, setMaterial] = useState(100);
  const [halfLives, setHalfLives] = useState(0);
  const [initialMaterial, setInitialMaterial] = useState<number>(100);
  const [initialText, setInitialText] = useState<string>('100');

  // Challenge mode: reach <= target grams within a limit of half-lives
  const [challengeTarget, setChallengeTarget] = useState<number | null>(null);
  const [challengeLimit, setChallengeLimit] = useState<number | null>(null);
  const [challengeMessage, setChallengeMessage] = useState<string>('');
  const [challengeActive, setChallengeActive] = useState(false);

  const runHalfLife = () => {
    if (material > 0.01) {
      setMaterial(m => m / 2);
      setHalfLives(h => h + 1);
    }
  };

  const startChallenge = () => {
    // Choose a random target (1-60g) and allowed half-lives (1-6)
    const tgt = Math.round(1 + Math.random() * 59);
    const lim = 1 + Math.floor(Math.random() * 6);
    setChallengeTarget(tgt);
    setChallengeLimit(lim);
    setChallengeMessage(`Challenge: Reach ≤ ${tgt}g within ${lim} half-lives.`);
    setChallengeActive(true);
    // Reset simulation for fresh attempt using current initialMaterial
    setMaterial(initialMaterial);
    setHalfLives(0);
  };

  const checkChallenge = () => {
    if (!challengeActive || challengeTarget === null || challengeLimit === null) return;
    if (halfLives <= challengeLimit && material <= challengeTarget) {
      setChallengeMessage(`✅ Challenge succeeded in ${halfLives} half-lives!`);
    } else {
      setChallengeMessage(`❌ Challenge failed. After ${halfLives} half-lives you have ${material.toFixed(2)}g.`);
    }
  };

  const resetGame = () => {
    setMaterial(initialMaterial);
    setHalfLives(0);
  };
  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF', textAlign: 'center', marginTop: 12, marginBottom: 12 }}>Half-Life Timer</Text>

        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, color: '#666666' }}><Text style={{ fontWeight: '700', color: '#000000' }}>Initial Material: </Text><Text style={{ fontWeight: '900', color: '#0066FF' }}>{initialMaterial}g</Text></Text>
          <View style={{ height: 8 }} />
          <TextInput
            keyboardType="numeric"
            placeholder="Set initial material (grams)"
            value={initialText}
            onChangeText={t => setInitialText(t)}
            onBlur={() => {
              const n = parseFloat(initialText);
              if (!isNaN(n) && n > 0) {
                setInitialMaterial(n);
                setMaterial(n);
              } else {
                setInitialText(String(initialMaterial));
              }
            }}
            style={{ width: '100%', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#0066FF', marginBottom: 8, backgroundColor: '#FFFFFF', color: '#000000' }}
          />
          <Text style={{ fontSize: 16, color: '#666666', marginTop: 8 }}><Text style={{ fontWeight: '700', color: '#000000' }}>Half-Lives Elapsed: </Text><Text style={{ fontWeight: '900', color: '#0066FF' }}>{halfLives}</Text></Text>
          <Text style={{ fontSize: 20, fontWeight: '900', marginTop: 12, color: material > 50 ? '#0066FF' : material > 10 ? '#666666' : '#000000' }}>
            Remaining Material: {material.toFixed(2)}g
          </Text>
          {challengeActive ? (
            <Text style={{ marginTop: 10, color: '#000000', fontWeight: '700' }}>{challengeMessage}</Text>
          ) : (
            <Text style={{ marginTop: 10, color: '#666666' }}>Try a challenge to practice estimating half-lives under limits.</Text>
          )}
        </View>

        <WebButton
          title="Simulate 1 Half-Life Pass"
          onPress={runHalfLife}
          style={{ width: '100%', marginVertical: 6, backgroundColor: '#06b6d4', borderWidth: 1, borderColor: '#06b6d4' }}
          disabled={material <= 0.01}
        />
        <WebButton title={challengeActive ? 'Check Challenge' : 'Start Challenge'} onPress={() => challengeActive ? checkChallenge() : startChallenge()} style={{ width: '100%', marginVertical: 6, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
        <WebButton
          title="Reset Simulation"
          onPress={resetGame}
          style={{ width: '100%', backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700', marginVertical: 6 }}
        />

        <Text style={{ fontSize: 12, color: '#666666', marginTop: 12, textAlign: 'center' }}>*Concept: Each half-life reduces the remaining radioactive material by exactly 50%.</Text>

        <WebButton
          title="Back to Games"
          iconChar={ICONS.Back}
          onPress={() => setScreen('main')}
          style={{ width: '100%', marginTop: 12, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }}
        />
    </CenteredScreen>
  );
};

// Game 2: Radiation Distance Debunk (fixed input handling)
const RadiationDistanceDebunk = ({ setScreen }: { setScreen: (screen: string) => void }) => {
  const [distance, setDistance] = useState<number>(1);
  const [inputText, setInputText] = useState<string>(distance.toString());
  const [radiation, setRadiation] = useState<number>(100);

  const calculateRadiation = (d: number) => {
    const safeD = Math.max(0.01, d);
    const newRadiation = 100 / (safeD * safeD);
    setRadiation(newRadiation);
    setDistance(safeD);
    setInputText(String(safeD));
  };

  // parse input and calculate when user presses Calculate or blurs
  const applyInput = () => {
    const n = parseFloat(inputText);
    if (!isNaN(n)) calculateRadiation(n);
  };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF', textAlign: 'center', marginTop: 12, marginBottom: 12 }}>Radiation Distance Debunk</Text>

        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, color: '#666666' }}>Distance from Source (m): <Text style={{ fontWeight: '800', color: '#000000' }}>{distance.toFixed(2)}m</Text></Text>
          <Text style={{ fontSize: 22, fontWeight: '900', marginTop: 8, color: radiation > 75 ? '#FF6B6B' : radiation > 25 ? '#FFD700' : '#0066FF' }}>{`Radiation Dose: ${radiation.toFixed(2)}%`}</Text>
        </View>

        <View style={{ flexDirection: 'row', marginBottom: 12 }}>
          <WebButton title="Move Closer (0.5m)" onPress={() => { setInputText('0.5'); calculateRadiation(0.5); }} style={{ flex: 1, marginRight: 6, backgroundColor: '#FF6B6B', borderWidth: 1, borderColor: '#FF6B6B' }} />
          <WebButton title="Move Further (2.0m)" onPress={() => { setInputText('2.0'); calculateRadiation(2.0); }} style={{ flex: 1, marginLeft: 6, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
        </View>

        <TextInput
          keyboardType="numeric"
          placeholder="Enter distance in meters"
          value={inputText}
          onChangeText={(t) => setInputText(t)}
          onBlur={applyInput}
          style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0066FF', marginBottom: 8, backgroundColor: '#FFFFFF', color: '#000000' }}
        />
        <WebButton title="Calculate" onPress={applyInput} style={{ width: '100%', marginBottom: 8, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />

        <WebButton title="Reset to 1m" onPress={() => calculateRadiation(1)} style={{ width: '100%', marginBottom: 8, backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700' }} />

        <Text style={{ fontSize: 12, color: '#666666', marginTop: 12, textAlign: 'center' }}>*Concept: Radiation exposure drops rapidly as distance increases (Inverse Square Law). Doubling the distance means 1/4th the exposure.</Text>

        <WebButton title="Back to Games" iconChar={ICONS.Back} onPress={() => setScreen('main')} style={{ width: '100%', marginTop: 12, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
    </CenteredScreen>
  );
};

// Game 3: Half-Life Trainer (REPLACES Myth or Fact Sorter)
const HalfLifeTrainer = ({ setScreen, onMedalEarned, gameId }: { setScreen: (screen: string) => void; onMedalEarned?: (gameId: string) => void; gameId?: string }) => {
  const randomInitial = () => {
    const choices = [50, 100, 200, 250, 500];
    return choices[Math.floor(Math.random() * choices.length)];
  };
  const [initialMaterial, setInitialMaterial] = useState<number>(randomInitial());
  const [targetHalfLives, setTargetHalfLives] = useState(Math.floor(Math.random() * 6) + 1); // Target 1-6 half-lives (harder)
  const [guess, setGuess] = useState('');
  const [message, setMessage] = useState('');
  const [correct, setCorrect] = useState(false);

  const calculateTarget = (numLives: number) => {
    let target = initialMaterial;
    for (let i = 0; i < numLives; i++) {
      target /= 2;
    }
    return target;
  };

  const handleGuess = () => {
    if (correct) return;
    const n = parseFloat(guess);
    const target = calculateTarget(targetHalfLives);

    if (isNaN(n)) {
      setMessage('Please enter a valid number.');
      return;
    }

    // Harder check: require within 1% relative error or within 0.02g absolute
    const relError = Math.abs(n - target) / Math.max(1e-6, target);
    if (relError <= 0.01 || Math.abs(n - target) <= 0.02) {
      setMessage(`✅ Correct! After ${targetHalfLives} half-lives, ${target.toFixed(2)}g remains. You've earned a medal!`);
      setCorrect(true);
      try { if (onMedalEarned) onMedalEarned(gameId || 'G3'); } catch (e) {}
    } else {
      // Provide a short hint explaining the calculation to be educational
      setMessage(`❌ Incorrect. Your guess was ${n.toFixed(2)}g. Hint: each half-life halves the material -> remaining = ${initialMaterial} * (1/2)^${targetHalfLives} = ${target.toFixed(2)}g.`);
    }
  };

  const resetGame = () => {
    setInitialMaterial(randomInitial());
    setTargetHalfLives(Math.floor(Math.random() * 4) + 1);
    setGuess('');
    setMessage('');
    setCorrect(false);
  };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF', textAlign: 'center', marginTop: 12, marginBottom: 12 }}>Half-Life Trainer</Text>
        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, color: '#666666' }}><Text style={{ fontWeight: '700', color: '#000000' }}>Initial Material:</Text> <Text style={{ fontWeight: '900', color: '#0066FF' }}>{initialMaterial}g</Text></Text>
          <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 8, color: '#000000' }}>
            Question: How much material remains after <Text style={{ color: '#0066FF', fontWeight: '900' }}>{targetHalfLives}</Text> half-lives?
          </Text>
          <Text style={{ fontSize: 12, color: '#666666', marginTop: 12 }}>Tip: Each half-life reduces the remaining material by 50%.</Text>
        </View>

        <TextInput
          keyboardType="numeric"
          placeholder="Enter your guess (grams)"
          placeholderTextColor={'#999999'}
          value={guess}
          onChangeText={setGuess}
          style={{ width: '100%', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#0066FF', marginBottom: 8, backgroundColor: '#FFFFFF', color: '#000000' }}
          editable={!correct}
        />

        <WebButton title="Submit Guess" onPress={handleGuess} style={{ width: '100%', marginBottom: 8, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} disabled={correct || !guess} />
        {message ? <Text style={{ textAlign: 'center', marginBottom: 12, color: correct ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>{message}</Text> : null}
        <WebButton title="Reset/New Question" onPress={resetGame} style={{ width: '100%', backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700', marginVertical: 6 }} />

        <WebButton title="Back to Games" iconChar={ICONS.Back} onPress={() => setScreen('main')} style={{ width: '100%', marginTop: 12, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
    </CenteredScreen>
  );
};


// Game 4: Fission Chain Reaction (simplified playable)
const FissionChainReaction = ({ setScreen, onMedalEarned, gameId }: { setScreen: (screen: string) => void; onMedalEarned?: (gameId: string) => void; gameId?: string }) => {
  const [neutrons, setNeutrons] = useState(1);
  const [target, setTarget] = useState(Math.floor(Math.random() * 5) + 6); // 6-10 neutrons to maintain (narrower)
  const [message, setMessage] = useState('Keep the reaction controlled — reach the target without runaway.');
  const [completed, setCompleted] = useState(false);
  const [controlRodUses, setControlRodUses] = useState(2); // limited uses for difficulty

  const release = () => {
    if (completed) return;
    const added = 1 + Math.floor(Math.random() * 3); // add 1-3 neutrons
    const next = neutrons + added;
    setNeutrons(next);
    if (next >= target && next <= target + 2) {
      setCompleted(true);
      setMessage('✅ Success — Controlled chain maintained!');
      try { SoundManager.play('correct'); } catch (e) {}
      try { if (onMedalEarned) onMedalEarned(gameId || 'G4'); } catch (e) {}
    } else if (next > target + 2) {
      setMessage('💥 Runaway — too many neutrons! Use control rods or reset.');
      try { SoundManager.play('incorrect'); } catch (e) {}
    } else {
      setMessage(`Neutrons: ${next} — target ${target}`);
    }
  };

  const insertControlRod = () => {
    if (controlRodUses <= 0 || completed) return;
    const reduce = 1 + Math.floor(Math.random() * 3); // reduce 1-3
    const next = Math.max(0, neutrons - reduce);
    setNeutrons(next);
    setControlRodUses(u => u - 1);
    setMessage(`Control rod inserted: -${reduce} neutrons. Neutrons: ${next}`);
  };

  const reset = () => {
    setNeutrons(1);
    setTarget(Math.floor(Math.random() * 5) + 6);
    setMessage('Restarted. Try to reach the controlled target.');
    setCompleted(false);
    setControlRodUses(2);
  };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ width: '100%', maxWidth: CONTENT_MAX_WIDTH }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF', textAlign: 'center', marginTop: 12, marginBottom: 12 }}>Fission Chain Reaction</Text>
        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, color: '#666666', marginBottom: 8 }}><Text style={{ fontWeight: '700', color: '#000000' }}>Status: </Text><Text style={{ fontWeight: '900', color: completed ? '#0066FF' : '#000000' }}>{message}</Text></Text>
          <Text style={{ fontWeight: '900', fontSize: 18, color: '#0066FF', marginBottom: 4 }}>Neutrons: {neutrons}</Text>
          <Text style={{ color: '#666666', marginTop: 8, marginBottom: 8 }}>Target range: <Text style={{ fontWeight: '700', color: '#0066FF' }}>{target} to {target + 2}</Text></Text>
          <Text style={{ fontSize: 12, color: '#666666', textAlign: 'center' }}>*Goal: Reach the narrow target range without runaway. Use control rods (limited) to manage spikes.</Text>
        </View>
        <WebButton title="Release Neutron" onPress={release} style={{ width: '100%', marginBottom: 8, backgroundColor: '#FF6B6B', borderWidth: 1, borderColor: '#FF6B6B' }} disabled={completed} />
        <WebButton title={`Insert Control Rod (${controlRodUses} left)`} onPress={insertControlRod} style={{ width: '100%', backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF', marginBottom: 8 }} disabled={controlRodUses <= 0 || completed} />
        <WebButton title="Reset" onPress={reset} style={{ width: '100%', backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700', marginVertical: 6 }} />
        <WebButton title="Back to Games" iconChar={ICONS.Back} onPress={() => setScreen('main')} style={{ width: '100%', marginTop: 12, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
    </CenteredScreen>
  );
};

// Game 5: Waste Repository Builder (more challenging with per-layer quizzes)
const WasteRepositoryBuilder = ({ setScreen, onMedalEarned, gameId }: { setScreen: (screen: string) => void; onMedalEarned?: (gameId: string) => void; gameId?: string }) => {
  const layers = [
    { id: 'L1', label: 'Waste form', question: { q: 'Which is typically high-level waste (HLW)?', options: ['Paper waste','Spent nuclear fuel','Garden clippings','Glass bottles'], a: 'Spent nuclear fuel' } },
    { id: 'L2', label: 'Overpack / Canister', question: { q: 'What is the canister mainly for?', options: ['Decoration','Containment and mechanical protection','Fertilizer','Cooling water'], a: 'Containment and mechanical protection' } },
    { id: 'L3', label: 'Inner liner', question: { q: 'Why include an inner liner?', options: ['To leak faster','To limit corrosion and contain radionuclides','To add color','To increase thermal output'], a: 'To limit corrosion and contain radionuclides' } },
    { id: 'L4', label: 'Buffer (bentonite)', question: { q: 'What does bentonite provide?', options: ['Electrical conduction','Low permeability and swelling','Radiation','Magnetism'], a: 'Low permeability and swelling' } },
    { id: 'L5', label: 'Backfill', question: { q: 'Backfill in repository design helps to', options: ['Increase voids','Control groundwater flow and fill spaces','Speed up decay','Make it look tidy'], a: 'Control groundwater flow and fill spaces' } },
    { id: 'L6', label: 'Engineered barrier', question: { q: 'Engineered barriers primarily', options: ['Decorate the site','Limit release and slow transport','Generate electricity','Absorb sunlight'], a: 'Limit release and slow transport' } },
    { id: 'L7', label: 'Seals', question: { q: 'Seals reduce which of the following?', options: ['Air temperature','Flow pathways around excavations','Noise','Visual impact'], a: 'Flow pathways around excavations' } },
    { id: 'L8', label: 'Host rock', question: { q: 'A good host rock typically provides', options: ['High permeability','Geological stability and low permeability','Fertile soil','Surface water'], a: 'Geological stability and low permeability' } },
  ];

  const [added, setAdded] = useState<string[]>([]);
  const [message, setMessage] = useState('Add layers to create a multi-barrier system. Answer a short question to add each layer.');
  const [pendingQuestionIndex, setPendingQuestionIndex] = useState<number | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [questionMessage, setQuestionMessage] = useState<string | null>(null);

  const startQuestionFor = (idx: number) => {
    setPendingQuestionIndex(idx);
    setAttemptsLeft(2);
    setQuestionMessage(null);
  };

  const answerQuestion = (idx: number, option: string) => {
    const q = layers[idx].question;
    if (!q) return;
    if (option === q.a) {
      const newAdded = [...added, layers[idx].label];
      setAdded(newAdded);
      setPendingQuestionIndex(null);
      setQuestionMessage(null);
      setMessage(`${newAdded.length}/${layers.length} layers added.`);
      try { SoundManager.play('correct'); } catch (e) {}
      if (newAdded.length === layers.length) {
        setMessage('✅ Repository complete! Well done.');
        try { if (onMedalEarned) onMedalEarned(gameId || 'G5'); } catch (e) {}
      }
    } else {
      const left = attemptsLeft - 1;
      setAttemptsLeft(left);
      if (left <= 0) {
        setQuestionMessage('No attempts left for this layer. Reset to try again.');
        setPendingQuestionIndex(null);
      } else {
        setQuestionMessage(`Incorrect. ${left} attempt(s) remaining.`);
      }
      try { SoundManager.play('incorrect'); } catch (e) {}
    }
  };

  const toggleLayer = (layerLabel: string) => {
    const idx = layers.findIndex(l => l.label === layerLabel);
    if (idx === -1) return;
    // If already added, allow removing only the last added
    if (added.includes(layerLabel)) {
      if (added[added.length - 1] === layerLabel) {
        setAdded(prev => prev.slice(0, -1));
        setMessage(`${added.length - 1}/${layers.length} layers added.`);
      } else {
        setMessage('You can only remove the last added layer. Follow the correct order.');
      }
      return;
    }

    // To add, require answering the quiz for this layer and ensure correct sequence
    if (idx === added.length) {
      startQuestionFor(idx);
    } else {
      setMessage('Incorrect order. Add the next layer in the sequence to build a stable repository.');
    }
  };

  const reset = () => { setAdded([]); setMessage('Add layers to create a multi-barrier system. Answer a short question to add each layer.'); setPendingQuestionIndex(null); setAttemptsLeft(2); setQuestionMessage(null); };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: '#FFFFFF' }} innerStyle={{ width: '100%' }}>
      <View style={{ width: '100%' }}>
        <Text style={{ fontSize: 24, fontWeight: '800', color: '#0066FF', textAlign: 'center', marginTop: 12, marginBottom: 12 }}>Waste Repository Builder</Text>
        <View style={{ backgroundColor: '#E6F3FF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', marginBottom: 12 }}>
          <Text style={{ fontSize: 16, color: '#666666', marginBottom: 8 }}><Text style={{ fontWeight: '700', color: '#000000' }}>Status: </Text><Text style={{ fontWeight: '900', color: added.length === layers.length ? '#0066FF' : '#000000' }}>{message}</Text></Text>
          {layers.map((layer, i) => (
            <TouchableOpacity key={layer.id} onPress={() => toggleLayer(layer.label)} style={{ padding: 10, backgroundColor: added.includes(layer.label) ? '#FFD700' : '#FFFFFF', borderRadius: 8, marginVertical: 6, borderWidth: 1, borderColor: added.includes(layer.label) ? '#FFD700' : '#0066FF' }}>
              <Text style={{ color: added.includes(layer.label) ? '#000000' : '#000000', fontWeight: '700', fontSize: 16 }}>{`${i + 1}. ${layer.label}`}</Text>
            </TouchableOpacity>
          ))}

          {/* If a question is pending, render the mini-quiz UI */}
          {pendingQuestionIndex !== null && pendingQuestionIndex >= 0 && pendingQuestionIndex < layers.length && (
            <View style={{ marginTop: 12, padding: 12, backgroundColor: '#E6F3FF', borderRadius: 10, borderWidth: 1, borderColor: '#0066FF' }}>
              <Text style={{ color: '#000000', fontWeight: '800', marginBottom: 8 }}>{`Question for layer ${pendingQuestionIndex + 1}:`}</Text>
              <Text style={{ color: '#666666', marginBottom: 10 }}>{layers[pendingQuestionIndex].question.q}</Text>
              {layers[pendingQuestionIndex].question.options.map((opt, oi) => (
                <Pressable key={oi} onPress={() => answerQuestion(pendingQuestionIndex, opt)} style={{ padding: 10, backgroundColor: '#FFFFFF', borderRadius: 8, marginBottom: 6, borderWidth: 1, borderColor: '#0066FF' }}>
                  <Text style={{ color: '#000000', fontWeight: '700' }}>{opt}</Text>
                </Pressable>
              ))}
              {questionMessage ? <Text style={{ color: '#ef4444', marginTop: 8 }}>{questionMessage}</Text> : null}
            </View>
          )}

          <Text style={{ fontSize: 12, color: '#666666', textAlign: 'center', marginTop: 8 }}>*Goal: Add all layers in order by answering short, focused questions for each layer.</Text>
        </View>

        <WebButton title="Reset" onPress={reset} style={{ width: '100%', backgroundColor: '#FFD700', borderWidth: 1, borderColor: '#FFD700', marginVertical: 6 }} />
        <WebButton title="Back to Games" iconChar={ICONS.Back} onPress={() => setScreen('main')} style={{ width: '100%', marginTop: 12, backgroundColor: '#0066FF', borderWidth: 1, borderColor: '#0066FF' }} />
      </View>
    </CenteredScreen>
  );
};

// 4d. Achievements Screen
const AchievementsScreen = ({ setScreen, achievements, logout, user }: { setScreen: (screen: string) => void; achievements: { stars: Record<string, number>; medals: Record<string, boolean> }; logout?: () => void; user?: any }) => {
  const renderStars = (count = 0) => {
    const stars = [];
    for (let i = 0; i < count; i++) stars.push('⭐');
    if (count === 0) return <Text style={{ color: colors.muted }}>No stars yet</Text>;
    return <Text>{stars.join(' ')}</Text>;
  };

  return (
    <CenteredScreen outerStyle={{ backgroundColor: colors.background }} innerStyle={{ width: '100%' }}>
      <View style={{ width: '100%' }}>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.accent, textAlign: 'center', marginBottom: 12 }}>Your Achievements {ICONS.Check}</Text>

        <View style={{ width: '100%' }}>
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Quiz Stars</Text>
          {appData.quizzes.map(qcat => (
            <View key={qcat.id} style={{ marginBottom: 8, padding: 10, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: '#e6f6fb' }}>
              <Text style={{ fontWeight: '700', marginBottom: 6 }}>{qcat.title}</Text>
              {qcat.levels.map(lv => (
                <View key={lv.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
                  <Text>{lv.title}</Text>
                  <View style={{ alignItems: 'flex-end' }}>{renderStars(achievements.stars[lv.id] ?? 0)}</View>
                </View>
              ))}
            </View>
          ))}

          <View style={{ height: 12 }} />
          <Text style={{ fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Game Medals</Text>
          {appData.games.map(g => (
            <View key={g.id} style={{ padding: 10, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: '#f3f4f6', marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700' }}>{g.title}</Text>
              <Text>{achievements.medals[g.id] ? '🏅 Medal Earned' : '—'}</Text>
            </View>
          ))}

          <View style={{ height: 16 }} />
          {user ? (
            <WebButton title="Log Out" onPress={() => { if (logout) logout(); }} style={{ width: '100%', backgroundColor: 'rgba(255,120,120,0.12)', marginBottom: 8 }} />
          ) : null}
          <WebButton title="Back to Main Menu" iconChar={ICONS.Back} onPress={() => setScreen('main')} style={{ borderColor: '#f3f4f6', width: '100%', backgroundColor: 'rgba(255,255,255,0.04)' }} />
        </View>
      </View>
    </CenteredScreen>
  );
};


// Game Router (Selects the correct game component to run)
type GameItem = {
  id: string;
  title: string;
};

type GameRunnerProps = {
  item: GameItem;
  setScreen: (screen: string) => void;
  onMedalEarned?: (gameId: string) => void;
};

const GameRunner: React.FC<GameRunnerProps> = ({ item, setScreen, onMedalEarned }) => {
  switch (item.id) {
    case 'G1':
      return <HalfLifeTimer setScreen={setScreen} />;
    case 'G2':
      return <RadiationDistanceDebunk setScreen={setScreen} />;
    case 'G3':
      return <HalfLifeTrainer setScreen={setScreen} onMedalEarned={onMedalEarned} gameId={item.id} />; // New game
    case 'G4':
      return <FissionChainReaction setScreen={setScreen} onMedalEarned={onMedalEarned} gameId={item.id} />; // New game
    case 'G5':
      return <WasteRepositoryBuilder setScreen={setScreen} onMedalEarned={onMedalEarned} gameId={item.id} />; // New game
    default:
      return (
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.text }}>Game Not Found</Text>
        </View>
      );
  }
};

// --- MAIN APP COMPONENT ---
export default function App() {
  // Allow build-time injection via `app.config.js` / `extra.backendUrl` or runtime override
  const configBackend = (Constants?.expoConfig?.extra?.backendUrl ?? Constants?.manifest?.extra?.backendUrl) as string | undefined;
  const initialBackend = configBackend || DEFAULT_BACKEND_URL;
  const [backendUrl, setBackendUrl] = useState<string>(initialBackend);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [screen, setScreen] = useState('taptostart');
  type QuizLevelItem = {
    id: string;
    title: string;
    questions: {
      q: string;
      a: string;
      options: string[];
      explanation: string;
    }[];
  };
  type BookItem = {
    id: string;
    title: string;
    content: string;
    reference: string;
  };
  type GameItem = {
    id: string;
    title: string;
  };

  type AppItem = QuizLevelItem | BookItem | GameItem | null;
  const [selectedItem, setSelectedItem] = useState<AppItem>(null);

  // Achievements: stars per quiz level and medals for games
  const [achievements, setAchievements] = useState<{ stars: Record<string, number>; medals: Record<string, boolean> }>({ stars: {}, medals: {} });
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [, setTick] = useState(0); // force re-render when we update appData from remote

  // Remote content fetch (backend) — will try to populate server content into appData
  const fetchRemoteContent = async () => {
    try {
      const qres = await fetch(`${backendUrl}/api/content/quizzes`);
      if (qres.ok) {
        const json = await qres.json();
        if (json.quizzes) {
          try {
            // Validate remote quizzes before overwriting local data
            if (Array.isArray(json.quizzes) && json.quizzes.every((q: any) => q && typeof q.id === 'string' && Array.isArray(q.levels))) {
              appData.quizzes = json.quizzes;
            } else {
              console.log('Remote quizzes payload invalid - keeping local quizzes');
            }
          } catch (e) {
            console.log('Error applying remote quizzes', e);
          }
        }
      }
      const bres = await fetch(`${backendUrl}/api/content/books`);
      if (bres.ok) {
        const jb = await bres.json();
        if (jb.books) {
          try {
            // Validate remote books before overwriting local data
            if (Array.isArray(jb.books) && jb.books.every((b: any) => b && typeof b.id === 'string' && typeof b.title === 'string')) {
              appData.books = jb.books;
            } else {
              console.log('Remote books payload invalid - keeping local books');
            }
          } catch (e) {
            console.log('Error applying remote books', e);
          }
        }
      }
      // force a rerender so components pick up new appData
      setTick(t => t + 1);
    } catch (e) {
      // silent fallback — keep local data
    }
  };

  // Load token/user/achievements from AsyncStorage on mount and fetch remote content
  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage) return;
        const t = await AsyncStorage.getItem('@ctm_token');
        const uraw = await AsyncStorage.getItem('@ctm_user');
        if (t) setToken(t);
        if (uraw) {
          const u = JSON.parse(uraw);
          setUser(u);
          if (u.achievements) setAchievements(u.achievements);
        } else {
          const raw = await AsyncStorage.getItem('@ctm_achievements');
          if (raw) setAchievements(JSON.parse(raw));
        }
        const b = await AsyncStorage.getItem('@ctm_backend_url');
        if (b) setBackendUrl(b);
      } catch (e) {}
      // Try to fetch remote content regardless of auth
      fetchRemoteContent();
    })();
  }, []);

  // Persist achievements when they change
  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage) return;
        await AsyncStorage.setItem('@ctm_achievements', JSON.stringify(achievements));
      } catch (e) {}
    })();
  }, [achievements]);

  const handleLogin = async (tok: string, u: any) => {
    try {
      setToken(tok);
      setUser(u);
      if (AsyncStorage) {
        await AsyncStorage.setItem('@ctm_token', tok);
        await AsyncStorage.setItem('@ctm_user', JSON.stringify(u));
      }
      if (u.achievements) setAchievements(u.achievements);
      // fetch remote content now that backend likely available
      fetchRemoteContent();
      setScreen('main');
    } catch (e) {}
  };

  // Persist backend URL when it changes
  useEffect(() => {
    (async () => {
      try {
        if (!AsyncStorage) return;
        await AsyncStorage.setItem('@ctm_backend_url', backendUrl);
      } catch (e) {}
    })();
  }, [backendUrl]);

  const logout = async () => {
    try {
      setToken(null);
      setUser(null);
      setAchievements({ stars: {}, medals: {} });
      if (AsyncStorage) {
        await AsyncStorage.removeItem('@ctm_token');
        await AsyncStorage.removeItem('@ctm_user');
      }
      setScreen('auth');
    } catch (e) {}
  };

  // Hide the splash screen on app startup
  useEffect(() => {
    (async () => {
      try {
        await SplashScreen.hideAsync();
      } catch (e) {}
    })();
  }, []);

  const awardStar = (levelId: string, score: number) => {
    try {
      const lvl = findItemById(levelId) as QuizLevelItem | null;
      const total = lvl && 'questions' in lvl ? lvl.questions.length : 0;
      const pct = total > 0 ? (score / total) : 0;
      const stars = Math.max(1, Math.round(pct * 3)); // 1-3 star scale, minimum 1 on completion
      setAchievements(prev => {
        const updated = { ...prev, stars: { ...prev.stars, [levelId]: stars } };
        // persist to backend if logged in
        (async () => {
          try {
            if (token && user) {
              await fetch(`${backendUrl}/api/users/${user._id}/achievements`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) });
            }
          } catch (e) {}
        })();
        return updated;
      });
    } catch (e) {}
  };

  const awardMedal = (gameId: string) => {
    setAchievements(prev => {
      const updated = { ...prev, medals: { ...prev.medals, [gameId]: true } };
      (async () => {
        try {
          if (token && user) {
            await fetch(`${backendUrl}/api/users/${user._id}/achievements`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(updated) });
          }
        } catch (e) {}
      })();
      return updated;
    });
  };

  type AppDataKey = keyof typeof appData;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current; // Opacity
  const slideAnim = useRef(new Animated.Value(20)).current; // Vertical slide
  const shimmerAnim = useRef(new Animated.Value(-240)).current; // For subtle moving shimmer

  // subtle shimmer loop for background decor
  useEffect(() => {
    const loop = () => {
      shimmerAnim.setValue(-240);
      Animated.timing(shimmerAnim, {
        toValue: 720,
        duration: 9000,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.quad),
      }).start(({ finished }) => { if (finished) loop(); });
    };
    loop();
    return () => { try { shimmerAnim.stopAnimation(); } catch (e) {} };
  }, []);

  const startTransition = () => {
    // 1. Reset values before starting new screen content
    fadeAnim.setValue(0);
    slideAnim.setValue(20);

    // 2. Start combined animation (Fade In and Slide Up)
    Animated.parallel([
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
            easing: Easing.ease,
        }),
        Animated.timing(slideAnim, {
            toValue: 0, // Slide up from 20 units below
            duration: 350,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.1)),
        }),
    ]).start();
  };

  // --- SOUND LOGIC (PLACEHOLDER) ---
  const playBackgroundMusicPlaceholder = () => {
    // Attempt to start looping background music using SoundManager if available.
    try {
      const bg = (() => { try { return require('./assets/bg.mp3'); } catch { return null; } })();
      if (bg) {
        SoundManager.playBackground(bg);
      } else {
        // no background asset found; still silently continue
      }
    } catch (e) {
      // silent fallback
    }
  };
  // --- END SOUND LOGIC ---

  const findItemById = (id: string) => {
    const categories: AppDataKey[] = ['quizzes', 'books', 'games'];
    for (const category of categories) {
      if (category === 'quizzes') {
        // New logic for multi-level quiz structure
        for (const quizCat of appData.quizzes) {
          for (const level of quizCat.levels) {
            if (level.id === id) return level as QuizLevelItem;
          }
        }
      } else if (Array.isArray(appData[category])) {
        // Existing logic for books and games
        const item = appData[category].find((i: { id: string }) => i.id === id);
        if (item) return item;
      }
    }
    return null;
  };

  // Effect: handle item loading and animations (single background music used)
  useEffect(() => {
    const parts = screen.split('_');
    const isRunScreen = screen.startsWith('quiz_run_') || screen.startsWith('book_run') || screen.startsWith('game_run');

    if (isRunScreen) {
      const itemId = screen.startsWith('quiz_run_') ? screen.substring('quiz_run_'.length) : parts[2];
      const item = findItemById(itemId);

      if (item) {
        setSelectedItem(item as AppItem);
      }
    } else if (screen.endsWith('_select') || screen === 'main' || screen === 'achievements') {
      setSelectedItem(null);
    }

    // Start transition animation for all screens so content is visible
    startTransition();
  }, [screen]);

  // Play a single background music track once on app startup
  useEffect(() => { playBackgroundMusicPlaceholder(); }, []);

    // Example: attempt to load optional sound assets (assets/correct.mp3, assets/incorrect.mp3)
    useEffect(() => {
      (async () => {
        try {
          if (ModuleExpoAv) {
            const correct = (() => { try { return require('./assets/correct.mp3'); } catch { return null; } })();
            const incorrect = (() => { try { return require('./assets/incorrect.mp3'); } catch { return null; } })();
            if (correct) await SoundManager.load('correct', correct);
            if (incorrect) await SoundManager.load('incorrect', incorrect);
          }
        } catch (e) {}
      })();
      return () => { SoundManager.unloadAll(); };
    }, []);

    const renderScreen = () => {
    // Show onboarding first
    if (showOnboarding) {
      return <OnboardingScreen onFinish={() => setShowOnboarding(false)} />;
    }

    // Wait until selectedItem is set for run screens
    if (screen.startsWith('quiz_run_') || screen.startsWith('book_run') || screen.startsWith('game_run')) {
      if (!selectedItem) {
        return (
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: colors.background }}>
            <Text style={{ color: colors.text }}>Loading Content...</Text>
          </View>
        );
      }
    }

    switch (screen) {
      case 'taptostart':
        return <TapToStartScreen onFinish={() => setScreen('auth')} />;
      case 'auth':
        return <AuthScreen onLogin={(tok: string, u: any) => handleLogin(tok, u)} backendUrl={backendUrl} setBackendUrl={setBackendUrl} />;
      case 'main_modules':
        // open MainMenuWithProfile with Modules tab active
        return user ? <MainMenuWithProfile initialTab={'modules'} setScreen={setScreen} setItem={setSelectedItem} user={user} logout={logout} achievements={achievements} /> : <MainMenu setScreen={setScreen} setItem={setSelectedItem} />;
      case 'main':
        // show profile-aware menu when user logged in
        return user ? <MainMenuWithProfile setScreen={setScreen} setItem={setSelectedItem} user={user} logout={logout} achievements={achievements} /> : <MainMenu setScreen={setScreen} setItem={setSelectedItem} />;
      case 'quiz_select':
        // Use new QuizCategoryScreen
        return <QuizCategoryScreen setScreen={setScreen} setItem={setSelectedItem} />;
      case 'book_categories':
        // New Book categories selection
        return <BookCategoryScreen setScreen={setScreen} setItem={setSelectedItem} />;
      case 'game_select':
        return <SelectionScreen category="game" setScreen={setScreen} setItem={setSelectedItem} />;
      case 'book_select':
        return <SelectionScreen category="book" setScreen={setScreen} setItem={setSelectedItem} />;

      // New Achievements Screen
      case 'achievements':
        return <AchievementsScreen setScreen={setScreen} achievements={achievements} logout={logout} user={user} />;
      case 'profile':
        return <ProfileScreen user={user} achievements={achievements} logout={logout} setScreen={setScreen} />;

      // New Quiz Runner Routes (Handles QZ#-E, QZ#-M, QZ#-H)
      case screen.startsWith('quiz_run_') ? screen : '': // Match any screen starting with quiz_run_
        if (selectedItem && 'questions' in selectedItem) {
          return <QuizRunner item={selectedItem as QuizItem} setScreen={setScreen} onComplete={(levelId, score) => awardStar(levelId, score)} />;
        }
        return null;

      // New Book Runner Routes (Handles any book_run_<ID>)
      case screen.startsWith('book_run_') ? screen : '':
        if (
          selectedItem &&
          typeof selectedItem === 'object' &&
          'content' in selectedItem &&
          'reference' in selectedItem
        ) {
          return <BookRunner item={selectedItem as BookItem} setScreen={setScreen} />;
        }
        return null;

      // New Game Runner Routes (Handles G1, G2, G3, G4, G5)
      case 'game_run_G1':
      case 'game_run_G2':
      case 'game_run_G3':
      case 'game_run_G4':
      case 'game_run_G5':
        if (selectedItem && typeof selectedItem === 'object' && 'id' in selectedItem && 'title' in selectedItem) {
          return <GameRunner item={selectedItem as GameItem} setScreen={setScreen} onMedalEarned={(gid: string) => awardMedal(gid)} />;
        }
        return null;

      default:
        return (
          <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: colors.background }}>
            <Text style={{ color: colors.text }}>404 Screen Not Found:</Text>
            <Text style={{ color: colors.muted, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{screen}</Text>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: showOnboarding ? colors.background : '#FFFFFF' }}>
      {!showOnboarding && screen !== 'taptostart' && screen !== 'auth' && (
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryDark]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
        />
      )}
      {showOnboarding && (
        <LinearGradient
          colors={[colors.primaryLight, colors.primaryDark]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
        />
      )}
      <StatusBar barStyle={showOnboarding || screen === 'auth' ? 'dark-content' : 'dark-content'} />
      {renderScreen()}
    </SafeAreaView>
  );
}