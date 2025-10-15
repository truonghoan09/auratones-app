const en = {
  header: {
    nav: {
      chords: 'Chord Library',
      songs: 'Song Library',
      practice: 'Practice App',
      courses: 'Courses',
      theory: 'Music theory',
    },
    account: 'Account',
    login_cta: 'Log in',
    profile: 'Profile',
    dashboard: 'Dashboard',
    admin: 'Admin Page',
    signout: 'Sign out',
    plan_badge_title: 'Plan: {plan}',
    plan: { free: 'Free', pro: 'Pro', enterprise: 'Enterprise', admin: 'Admin' },
    user_fallback: 'User',
    chord_display: {
      label: 'Chord display',
      symbol: 'Symbol (Δ/–/ø/°)',
      text: 'Text (maj/m/dim/aug)',
      title_on: 'Display: Symbol (Δ/–/ø/°)',
      title_off: 'Display: Text (maj/m/dim/aug)',
    },

    // ▼ New: Theme switcher labels (bilingual in-string)
    theme: {
      aria: 'Choose theme',
      options: {
        light:  'Light',
        dark:   'Dark',
        green:  'Green',
        blue:   'Blue',
        yellow: 'Yellow',
      },
    },
  },

  home: {
    hero: {
      eyebrow: 'AURATONES • MUSIC LEARNING',
      title_a: 'Learn music',
      title_b: 'smartly',
      title_c: 'Write sheet',
      title_d: 'right on the web',
      desc:
        'Accurate Vietnamese chord extraction, active practice, and fast course/quiz creation — all in one place.',
      cta_primary_loggedin: 'Start practicing',
      cta_secondary_loggedin: 'Your dashboard, {name}',
      cta_primary_guest: 'Get started free',
      cta_secondary_guest: 'See basic theory',
      badges: { chord: 'VN Chords', sheet: 'Sheet Editor', course: 'Courses & Quiz' },
    },
    tools: {
      title: 'Pick a tool to start',
      desc: 'Navigate or let it auto-advance after a few seconds.',
      items: {
        chords: { title: 'Chord Library', desc: 'Find chords for Vietnamese songs and practice smooth transitions.', cta: 'Explore' },
        songs:  { title: 'Song Library',  desc: 'Hundreds of analyzed songs — practice what you love.',            cta: 'View' },
        sheet:  { title: 'Write Sheet (Beta)', desc: 'Compose in browser, save personal versions, share easily.',   cta: 'Try now' },
        practice: { title: 'Practice App', desc: 'Metronome, tuner, finger drills & chord loops by level.',        cta: 'Start' },
      },
    },
    why: {
      title: 'Why Auratones?',
      a_t: 'VN chords with rigor',
      a_d: 'Optimized chord extraction for Vietnamese music, less noise.',
      b_t: 'Browser-native sheet editor',
      b_d: 'Write, preview, version — no extra installs.',
      c_t: 'Courses & quizzes for teachers',
      c_d: 'Build tracks, lessons, banks; follow student progress.',
    },
    edu: {
      title: 'For teachers & studios',
      desc: 'Design courses, publish lessons, quizzes, and manage classes seamlessly.',
      cta_loggedin_primary: 'Create a course',
      cta_loggedin_secondary: 'My courses',
      cta_guest_primary: 'Sign up to start',
      cta_guest_secondary: 'Preview content',
    },
    updates: { title: 'Recent updates' },
    roadmap: { title: 'Roadmap' },
    testimonials: { title: 'What users say' },
    ribbon: {
      guest: 'Join for free — upgrade when ready.',
      user_prefix: 'Happy practicing,',
      user_suffix: '🎵',
      to_practice: 'Continue practicing',
      register_now: 'Register now',
    },
  },
  chords: {
    aria: {
      toc: "Root index",
      roots: "Roots",
      chooseInstrument: "Choose instrument",
      filter: "Chord filter",
      search: "Search chords",
    },
    labels: {
      roots: "Roots",
    },
    instruments: {
      guitar: "Guitar",
      ukulele: "Ukulele",
      piano: "Piano",
    },
    filters: {
      none: "No filter",
      chordOfCMajor: "CMajor (C Dm Em F G Am)",
      chordOfCMajorPlus: "CMajor+ (with 7th, dim)",
    },
    placeholders: {
      search: "Search… (e.g., C, Am, Cmaj7)",
    },
    actions: {
      addChord: "Add chord",
    },
    state: {
      loading: "Loading chords from server…",
      load_error_prefix: "Failed to load",
      load_error_fallback: "Failed to load data",
      empty_filtered: "No chords match the current filter/search.",
    },
    toast: {
      submitted_system: "Chord submitted to system.",
      submitted_contrib: "Contribution submitted (preview).",
      submit_fail: "Failed to submit chord",
      voicing_saved: "Voicing saved.",
      voicing_saved_confirmed: "Voicing saved (overwrite/duplicate confirmed).",
      voicing_save_fail: "Failed to save voicing",
      voicing_dup_confirm: "Duplicate voicing. Save anyway?",
      voicing_dup_cancelled: "Cancelled due to duplicate voicing.",
      delete_not_found: "Voicing to delete not found.",
      delete_success_single: "Voicing deleted.",
      delete_success_scope: "Voicing deleted (including same shape & fingers).",
      delete_fail: "Failed to delete voicing.",
    },
  },
};

export default en;
