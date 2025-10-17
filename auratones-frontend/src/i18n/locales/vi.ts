const vi = {
  header: {
    nav: {
      chords: 'Kho hợp âm',
      songs: 'Kho bài hát',
      practice: 'Ứng dụng học bài',
      courses: 'Khóa học',
      theory: 'Lý thuyết âm nhạc',
    },
    account: 'Tài khoản',
    login_cta: 'Đăng nhập',
    profile: 'Hồ sơ',
    dashboard: 'Dashboard',
    admin: 'Trang Admin',
    signout: 'Đăng xuất',
    plan_badge_title: 'Gói: {plan}',
    plan: { free: 'Free', pro: 'Pro', enterprise: 'Enterprise', admin: 'Admin' },
    user_fallback: 'Người dùng',
    chord_display: {
      label: 'Hiển thị hợp âm',
      symbol: 'Ký tự (Δ/–/ø/°)',
      text: 'Chữ (maj/m/dim/aug)',
      title_on: 'Hiển thị: Ký tự (Δ/–/ø/°)',
      title_off: 'Hiển thị: Chữ (maj/m/dim/aug)',
      // ▼ NEW: nhãn gọn cho nút chip
      symbol_short: 'Δ / ø',
      text_short: 'maj / m',
    },

    // Theme switcher labels
    theme: {
      aria: 'Chọn chủ đề',
      options: {
        light:  'Sáng',
        dark:   'Tối',
        green:  'Xanh lá',
        blue:   'Xanh dương',
        yellow: 'Vàng',
      },
    },
    auth: {
      close: "Đóng",
      username_label: "Tên người dùng",
      password_label: "Mật khẩu",
      username_placeholder: "Tên người dùng",
      password_placeholder: "Mật khẩu",
      or: "hoặc",
      google_aria: "Tiếp tục với Google",

      forgot: "Quên mật khẩu?",

      login: {
        title: "Đăng nhập",
        submit: "Đăng nhập",
        to_register: "Chuyển sang đăng ký",
      },
      register: {
        title: "Đăng ký",
        submit: "Đăng ký",
        to_login: "Chuyển sang đăng nhập",
      },
      toast: {
        missing_both: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.",
        missing_username: "Vui lòng nhập tên đăng nhập.",
        missing_password: "Vui lòng nhập mật khẩu.",
        user_not_found: "Không tìm thấy người dùng.",
        incorrect_password: "Mật khẩu không đúng.",
        no_password_account: "Tài khoản này chưa có mật khẩu. Hãy đăng nhập bằng Google hoặc đặt mật khẩu.",
        username_taken: "Tên người dùng đã được sử dụng.",
        email_in_use: "Email đã được sử dụng.",
        server_error_generic: "Có lỗi xảy ra, vui lòng thử lại sau.",
        registered_success: "Đăng ký thành công và đã đăng nhập.",
        login_success: "Đăng nhập thành công.",
      },
    }
  },

  home: {
    hero: {
      eyebrow: 'AURATONES • HỌC NHẠC',
      title_a: 'Học nhạc',
      title_b: 'thông minh',
      title_c: 'Viết sheet',
      title_d: 'trực tiếp trên web',
      desc:
        'Tách hợp âm tiếng Việt chuẩn xác, luyện tập chủ động, và tạo khóa học/quiz cho giáo viên — tất cả tại một nơi.',
      cta_primary_loggedin: 'Bắt đầu luyện tập',
      cta_secondary_loggedin: 'Dashboard của {name}',
      cta_primary_guest: 'Bắt đầu miễn phí',
      cta_secondary_guest: 'Xem lý thuyết cơ bản',
      badges: { chord: 'Hợp âm VN', sheet: 'Soạn sheet', course: 'Khóa học & Quiz' },
    },
    tools: {
      title: 'Chọn công cụ để bắt đầu',
      desc: 'Di chuyển qua lại hoặc để hệ thống tự gợi ý sau vài giây.',
      items: {
        chords:   { title: 'Kho hợp âm', desc: 'Tìm hợp âm bài hát tiếng Việt và luyện chuyển hợp âm mượt mà.', cta: 'Khám phá' },
        songs:    { title: 'Kho bài hát', desc: 'Hàng trăm bài có phân tích hợp âm & nhịp — luyện tập theo sở thích.', cta: 'Vào xem' },
        sheet:    { title: 'Viết sheet (Beta)', desc: 'Soạn sheet trực tiếp trên web, lưu phiên bản riêng & chia sẻ dễ dàng.', cta: 'Thử ngay' },
        practice: { title: 'Ứng dụng luyện bài', desc: 'Metronome, tuner, bài tập ngón & vòng hợp âm theo level.', cta: 'Bắt đầu' },
      },
    },
    why: {
      title: 'Tại sao là Auratones?',
      a_t: 'Hợp âm tiếng Việt “chuẩn khoa học”',
      a_d: 'Phân tích hợp âm tối ưu cho nhạc Việt, giảm sai lệch từ nguồn cộng đồng.',
      b_t: 'Soạn sheet trong trình duyệt',
      b_d: 'Viết, phát preview, lưu version cá nhân — không cần cài đặt thêm.',
      c_t: 'Khóa học & quiz cho giáo viên',
      c_d: 'Tạo lộ trình, bài giảng, bộ câu hỏi; theo dõi tiến độ học viên.',
    },
    edu: {
      title: 'Dành cho giáo viên & trung tâm',
      desc:
        'Thiết kế khóa học, đăng bài giảng, quiz và quản lý lớp ngay trên nền tảng. Tập trung vào âm nhạc — công cụ đã có sẵn.',
      cta_loggedin_primary: 'Tạo khóa học',
      cta_loggedin_secondary: 'Khóa học của tôi',
      cta_guest_primary: 'Đăng ký để bắt đầu',
      cta_guest_secondary: 'Xem thử nội dung',
    },
    updates: { title: 'Cập nhật gần đây' },
    roadmap: { title: 'Lộ trình sắp tới' },
    testimonials: { title: 'Cảm nhận từ người dùng' },
    ribbon: {
      guest: 'Tham gia miễn phí — nâng cấp khi bạn sẵn sàng.',
      user_prefix: 'Chúc',
      user_suffix: 'luyện tập vui vẻ 🎵',
      to_practice: 'Tiếp tục luyện tập',
      register_now: 'Đăng ký ngay',
    },
  },
  chords: {
    aria: {
      toc: "Mục lục theo nốt gốc",
      roots: "Nốt gốc",
      chooseInstrument: "Chọn nhạc cụ",
      filter: "Bộ lọc hợp âm",
      search: "Tìm hợp âm",
    },
    labels: {
      roots: "Nốt gốc",
    },
    instruments: {
      guitar: "Guitar",
      ukulele: "Ukulele",
      piano: "Piano",
    },
    filters: {
      none: "Không lọc",
      chordOfCMajor: "CMajor (C Dm Em F G Am)",
      chordOfCMajorPlus: "CMajor+ (thêm 7th, dim)",
    },
    placeholders: {
      search: "Tìm… (vd: C, Am, Cmaj7)",
    },
    actions: {
      addChord: "Thêm hợp âm",
    },
    state: {
      loading: "Đang tải hợp âm từ máy chủ…",
      load_error_prefix: "Không tải được dữ liệu",
      load_error_fallback: "Lỗi tải dữ liệu",
      empty_filtered: "Không tìm thấy hợp âm phù hợp bộ lọc/tìm kiếm.",
    },
    toast: {
      submitted_system: "Đã gửi hợp âm vào hệ thống.",
      submitted_contrib: "Đã gửi bản đóng góp (preview).",
      submit_fail: "Gửi hợp âm thất bại",
      voicing_saved: "Đã lưu voicing vào hệ thống.",
      voicing_saved_confirmed: "Đã lưu voicing (đã xác nhận ghi đè/trùng).",
      voicing_save_fail: "Ghi voicing thất bại",
      voicing_dup_confirm: "Voicing trùng. Bạn có muốn vẫn lưu?",
      voicing_dup_cancelled: "Đã hủy lưu vì trùng voicing.",
      delete_not_found: "Không tìm thấy voicing cần xoá.",
      delete_success_single: "Đã xoá voicing.",
      delete_success_scope: "Đã xoá voicing (bao gồm các bản cùng form & fingers).",
      delete_fail: "Xoá voicing thất bại.",
    },
    like_prompt: {
      title: "Thông báo",
      message: "Bạn cần đăng nhập để thực hiện chức năng \"Yêu thích\"!",
      login: "Đăng nhập",
      continue_guest: "Tiếp tục (Không đăng nhập)",
    },
  },
  common: {
    loading: "Đang tải",
    please_wait: "Vui lòng chờ…",
  },
};

export default vi;
