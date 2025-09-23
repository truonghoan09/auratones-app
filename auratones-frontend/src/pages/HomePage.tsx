// src/pages/HomePage.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import '../styles/homepage.scss';
import { useAuthContext } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

interface HomePageProps {
  onLoginClick: () => void;
  onLogout: () => void;
}

const HomePage: React.FC<HomePageProps> = ({ onLoginClick, onLogout }) => {
  const { isAuthenticated, user } = useAuthContext();
  const { t, lang } = useI18n();

  const displayName =
    user?.displayName || user?.username || user?.email?.split('@')[0] || (lang === 'vi' ? 'bạn' : 'you');

  // ====== Carousel data (dùng i18n) ======
  const tools = useMemo(
    () => [
      {
        key: 'chords',
        to: '/chords',
        icon: '🎸',
        title: t('home.tools.items.chords.title'),
        desc: t('home.tools.items.chords.desc'),
        cta: t('home.tools.items.chords.cta'),
      },
      {
        key: 'songs',
        to: '/songs',
        icon: '🎶',
        title: t('home.tools.items.songs.title'),
        desc: t('home.tools.items.songs.desc'),
        cta: t('home.tools.items.songs.cta'),
      },
      {
        key: 'sheet',
        to: '/sheet',
        icon: '📝',
        title: t('home.tools.items.sheet.title'),
        desc: t('home.tools.items.sheet.desc'),
        cta: t('home.tools.items.sheet.cta'),
      },
      {
        key: 'practice',
        to: '/practice',
        icon: '⏱️',
        title: t('home.tools.items.practice.title'),
        desc: t('home.tools.items.practice.desc'),
        cta: t('home.tools.items.practice.cta'),
      },
    ],
    [t]
  );

  // ====== Carousel logic ======
  const [idx, setIdx] = useState(0);
  const autoRef = useRef<number | null>(null);
  const SLIDE_MS = 5800;
  const go = (to: number) => setIdx((p) => (to + tools.length) % tools.length);
  const next = () => go(idx + 1);
  const prev = () => go(idx - 1);

  useEffect(() => {
    if (autoRef.current) window.clearInterval(autoRef.current);
    autoRef.current = window.setInterval(() => setIdx((p) => (p + 1) % tools.length), SLIDE_MS);
    return () => { if (autoRef.current) window.clearInterval(autoRef.current); };
  }, [tools.length]);

  // ====== Fake data (giữ như trước) ======
  const updates = [
    { title: 'Bổ sung trình soạn sheet (Beta)', time: '2 ngày trước', desc: 'Viết nốt, hợp âm, phiên bản lưu cá nhân; hỗ trợ preview trong trình duyệt.' },
    { title: 'Nâng cấp phân tích hợp âm tiếng Việt', time: '1 tuần trước', desc: 'Giảm sai số trong vòng lặp phổ biến; cải thiện xử lý hoà âm mượn.' },
    { title: 'Bài tập luyện ngón & vòng hợp âm', time: '2 tuần trước', desc: 'Thêm preset theo cấp độ, hỗ trợ metronome & đếm nhịp.' },
  ];
  const roadmap = [
    { title: 'Thư viện backing track', tag: 'Đang nghiên cứu' },
    { title: 'Chia sẻ sheet theo nhóm', tag: 'Sắp triển khai' },
    { title: 'Tiến trình học theo lộ trình', tag: 'Thiết kế' },
  ];
  const testimonials = [
    { name: 'Hà N.', role: 'Học guitar 6 tháng', text: 'Mình tập chuyển hợp âm mượt hơn hẳn, sheet trên web cũng dễ ghi chú.' },
    { name: 'Thịnh P.', role: 'Giáo viên', text: 'Tạo khóa học và quiz khá nhanh, theo dõi học viên gọn nhẹ.' },
    { name: 'Vy T.', role: 'Pianist', text: 'Phần tách hợp âm tiếng Việt chính xác, tiết kiệm thời gian dò hợp âm.' },
  ];

  return (
    <>
      <Header onLoginClick={onLoginClick} onLogout={onLogout} />

      <main className="homepage">
        {/* HERO */}
        <section className="hero">
          <div className="hero__inner">
            <div className="hero__text">
              <p className="eyebrow">{t('home.hero.eyebrow')}</p>
              <h1>
                {t('home.hero.title_a')} <span className="highlight">{t('home.hero.title_b')}</span>, {t('home.hero.title_c')}{' '}
                <span className="highlight">{t('home.hero.title_d')}</span>
              </h1>
              <p className="sub">{t('home.hero.desc')}</p>

              {isAuthenticated ? (
                <div className="cta-row">
                  <Link to="/practice" className="btn btn-primary">
                    {t('home.hero.cta_primary_loggedin')}
                  </Link>
                  <Link to="/dashboard" className="btn btn-ghost">
                    {t('home.hero.cta_secondary_loggedin', { name: displayName })}
                  </Link>
                </div>
              ) : (
                <div className="cta-row">
                  <button className="btn btn-primary" onClick={onLoginClick}>
                    {t('home.hero.cta_primary_guest')}
                  </button>
                  <Link to="/theory" className="btn btn-ghost">
                    {t('home.hero.cta_secondary_guest')}
                  </Link>
                </div>
              )}

              <div className="hero__badges">
                <span className="badge">{t('home.hero.badges.chord')}</span>
                <span className="badge">{t('home.hero.badges.sheet')}</span>
                <span className="badge">{t('home.hero.badges.course')}</span>
              </div>
            </div>

            <div className="hero__preview" aria-hidden="true">
              {/* svg minh hoạ */}
              <svg viewBox="0 0 240 180" className="preview-svg">
                <defs>
                  <linearGradient id="g" x1="0" x2="1">
                    <stop offset="0" stopColor="var(--accent-color)" stopOpacity="0.35" />
                    <stop offset="1" stopColor="var(--primary-color)" stopOpacity="0.55" />
                  </linearGradient>
                </defs>
                <rect width="240" height="180" rx="16" fill="url(#g)" />
                <g fill="none" stroke="white" strokeOpacity="0.8" strokeLinecap="round">
                  <path d="M16 60 H224" /><path d="M16 80 H224" /><path d="M16 100 H224" /><path d="M16 120 H224" />
                  <circle cx="86" cy="100" r="6" fill="white" />
                  <circle cx="126" cy="80" r="6" fill="white" />
                  <circle cx="166" cy="120" r="6" fill="white" />
                </g>
              </svg>
            </div>
          </div>
        </section>

        {/* TOOLS CAROUSEL */}
        <section className="tools">
          <div className="section-head">
            <h2>{t('home.tools.title')}</h2>
            <p>{t('home.tools.desc')}</p>
          </div>

          <div className="carousel" role="region" aria-label="tools carousel">
            <button className="nav prev" aria-label="previous" onClick={prev}>‹</button>

            <div className="viewport">
              <div className="track" style={{ transform: `translateX(calc(${idx} * -100%))` }}>
                {tools.map((tool) => (
                  <Link to={tool.to} className="slide" key={tool.key}>
                    <div className="slide__icon">{tool.icon}</div>
                    <h3>{tool.title}</h3>
                    <p>{tool.desc}</p>
                    <span className="slide__cta">{tool.cta}</span>
                  </Link>
                ))}
              </div>
            </div>

            <button className="nav next" aria-label="next" onClick={next}>›</button>

            <div className="dots" role="tablist" aria-label="carousel dots">
              {tools.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === idx}
                  className={`dot ${i === idx ? 'active' : ''}`}
                  onClick={() => go(i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* HIGHLIGHTS */}
        <section className="highlights">
          <div className="section-head"><h2>{t('home.why.title')}</h2></div>
          <div className="feature-grid">
            <div className="feature"><h4>{t('home.why.a_t')}</h4><p>{t('home.why.a_d')}</p></div>
            <div className="feature"><h4>{t('home.why.b_t')}</h4><p>{t('home.why.b_d')}</p></div>
            <div className="feature"><h4>{t('home.why.c_t')}</h4><p>{t('home.why.c_d')}</p></div>
          </div>
        </section>

        {/* EDU */}
        <section className="edu">
          <div className="edu__card">
            <div className="edu__text">
              <h3>{t('home.edu.title')}</h3>
              <p>{t('home.edu.desc')}</p>
              {isAuthenticated ? (
                <div className="cta-row">
                  <Link to="/courses/new" className="btn btn-primary">{t('home.edu.cta_loggedin_primary')}</Link>
                  <Link to="/courses" className="btn btn-ghost">{t('home.edu.cta_loggedin_secondary')}</Link>
                </div>
              ) : (
                <div className="cta-row">
                  <button className="btn btn-primary" onClick={onLoginClick}>{t('home.edu.cta_guest_primary')}</button>
                  <Link to="/courses" className="btn btn-ghost">{t('home.edu.cta_guest_secondary')}</Link>
                </div>
              )}
            </div>
            <div className="edu__illu" aria-hidden="true"><div className="edu__blob" /></div>
          </div>
        </section>

        {/* UPDATES + ROADMAP */}
        <section className="updates">
          <div className="updates__grid">
            <div className="updates__col">
              <h3>{t('home.updates.title')}</h3>
              <div className="list">
                {updates.map((u, i) => (
                  <div key={i} className="list-item">
                    <div className="list-title">{u.title}</div>
                    <div className="list-time">{u.time}</div>
                    <div className="list-desc">{u.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="updates__col">
              <h3>{t('home.roadmap.title')}</h3>
              <div className="list">
                {roadmap.map((r, i) => (
                  <div key={i} className="list-item">
                    <div className="list-title">{r.title}</div>
                    <div className="tag">{r.tag}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testi">
          <h3 className="section-title">{t('home.testimonials.title')}</h3>
          <div className="testi__grid">
            {testimonials.map((c, i) => (
              <figure key={i} className="quote">
                <blockquote>“{c.text}”</blockquote>
                <figcaption><span className="name">{c.name}</span><span className="role"> · {c.role}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* CTA RIBBON */}
        <section className="ribbon">
          <p>
            {isAuthenticated
              ? `${t('home.ribbon.user_prefix')} ${displayName} ${t('home.ribbon.user_suffix')}`
              : t('home.ribbon.guest')}
          </p>
          {isAuthenticated ? (
            <Link to="/practice" className="btn btn-primary">{t('home.ribbon.to_practice')}</Link>
          ) : (
            <button className="btn btn-primary" onClick={onLoginClick}>{t('home.ribbon.register_now')}</button>
          )}
        </section>
      </main>
    </>
  );
};

export default HomePage;
