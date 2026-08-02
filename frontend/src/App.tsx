import {
  Archive,
  ArrowUp,
  BadgeCheck,
  BookOpenText,
  ChevronDown,
  FileBadge,
  LogOut,
  Menu,
  MessageSquare,
  MailWarning,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Scale,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ApiError,
  apiFetch,
  login,
  logout,
  refreshAccessToken,
  register,
  resendVerification,
  verifyEmail,
} from "./api";
import type {
  ChatMessage,
  Conversation,
  PublicUser,
  SourceSnapshot,
} from "./types";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ar-EG", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const isArabic = (value: string) => /[\u0600-\u06ff]/.test(value);

type AuthView = "login" | "register";

function EmailVerificationScreen({ token }: { token: string | null }) {
  const [status, setStatus] = useState<
    "verifying" | "verified" | "failed" | "missing"
  >(token ? "verifying" : "missing");
  const [error, setError] = useState("");
  const [resendNotice, setResendNotice] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    verifyEmail(token)
      .then(() => {
        if (active) setStatus("verified");
      })
      .catch((cause) => {
        if (!active) return;
        setStatus("failed");
        setError(
          cause instanceof ApiError
            ? cause.message
            : "تعذر الاتصال بالخادم للتحقق من البريد الإلكتروني.",
        );
      });
    return () => {
      active = false;
    };
  }, [token]);

  const submitResend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setResending(true);
    setError("");
    setResendNotice("");
    try {
      await resendVerification(String(form.get("email") ?? ""));
      setResendNotice(
        "إذا كان الحساب موجوداً ولم يُفعّل، فسيصل رابط تحقق جديد إلى البريد.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "تعذر إرسال رابط تحقق جديد.",
      );
    } finally {
      setResending(false);
    }
  };

  const goToLogin = () => {
    window.location.assign("/");
  };

  const isFailure = status === "failed" || status === "missing";

  return (
    <main className="auth-shell verification-shell">
      <section className="auth-masthead" aria-label="LegalMind email verification">
        <div className="brand-seal"><Scale size={31} strokeWidth={1.5} /></div>
        <p className="eyebrow">LM / EMAIL VERIFICATION</p>
        <h1>ليجال<span>مايند</span></h1>
        <p className="auth-thesis">
          تأكيد البريد يحمي حسابك ومحادثاتك القانونية من الوصول غير المصرح به.
        </p>
      </section>

      <section className="auth-panel verification-panel">
        <div
          className={`verification-mark ${status}`}
          aria-hidden="true"
        >
          {status === "verified" ? (
            <BadgeCheck size={34} />
          ) : isFailure ? (
            <MailWarning size={34} />
          ) : (
            <RefreshCw size={30} className="verification-spinner" />
          )}
        </div>

        {status === "verifying" ? (
          <>
            <p className="case-number">CHECKING SECURE TOKEN</p>
            <h2>جارٍ التحقق من بريدك الإلكتروني…</h2>
            <p>يرجى الانتظار لحظات وعدم إغلاق الصفحة.</p>
          </>
        ) : null}

        {status === "verified" ? (
          <>
            <p className="case-number">EMAIL VERIFIED</p>
            <h2>تم تفعيل البريد الإلكتروني</h2>
            <p>
              أصبح حسابك جاهزاً. يمكنك الآن تسجيل الدخول إلى مساحة البحث
              القانونية.
            </p>
            <button className="primary-action" onClick={goToLogin}>
              الانتقال إلى تسجيل الدخول
            </button>
          </>
        ) : null}

        {isFailure ? (
          <>
            <p className="case-number">VERIFICATION LINK ERROR</p>
            <h2>
              {status === "missing"
                ? "رابط التحقق غير مكتمل"
                : "تعذر تفعيل البريد الإلكتروني"}
            </h2>
            <p className="form-notice error">
              {status === "missing"
                ? "لا يحتوي الرابط على رمز تحقق. افتح الرابط الكامل الموجود في رسالة البريد."
                : error}
            </p>
            <form className="auth-form verification-resend" onSubmit={submitResend}>
              <label>
                البريد الإلكتروني
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="name@example.com"
                />
              </label>
              <button className="primary-action" disabled={resending}>
                {resending ? "جارٍ الإرسال…" : "إرسال رابط تحقق جديد"}
              </button>
            </form>
            {resendNotice ? (
              <p className="form-notice success">{resendNotice}</p>
            ) : null}
            <button className="text-action" onClick={goToLogin}>
              العودة إلى تسجيل الدخول
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: PublicUser) => void }) {
  const [view, setView] = useState<AuthView>("login");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      onAuthenticated(
        await login(String(form.get("email") ?? ""), String(form.get("password") ?? "")),
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "تعذر الاتصال بالخادم.",
      );
    } finally {
      setBusy(false);
    }
  };

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      await register({
        fullName: String(form.get("fullName") ?? ""),
        email: String(form.get("email") ?? ""),
        password: String(form.get("password") ?? ""),
        officeName: String(form.get("officeName") ?? ""),
        teamSize: String(form.get("teamSize") ?? "solo") as
          | "solo"
          | "small"
          | "medium"
          | "large",
        barAssociationNumber:
          String(form.get("barAssociationNumber") ?? "") || undefined,
      });
      setNotice("تم إنشاء الحساب. راجع بريدك الإلكتروني لتفعيل الحساب.");
      setView("login");
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "تعذر إكمال التسجيل.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-masthead" aria-label="LegalMind introduction">
        <div className="brand-seal"><Scale size={31} strokeWidth={1.5} /></div>
        <p className="eyebrow">منصة بحث قانوني مصرية</p>
        <h1>ليجال<span>مايند</span></h1>
        <p className="auth-thesis">
          مساحة عمل تحفظ مسار البحث، وتربط كل إجابة بالنص الذي استندت إليه.
        </p>
        <div className="docket-line">
          <span>01</span>
          <p>مصادر محفوظة كما ظهرت وقت الإجابة</p>
        </div>
        <div className="docket-line">
          <span>02</span>
          <p>متابعة ذكية للسؤال في سياقه السابق</p>
        </div>
        <div className="docket-line">
          <span>03</span>
          <p>فصل كامل بين بيانات المستخدم والمتن القانوني</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-heading">
          <p className="case-number">LM / ACCESS / 2026</p>
          <h2>{view === "login" ? "الدخول إلى مساحة العمل" : "طلب حساب محامٍ"}</h2>
          <p>بياناتك ومحادثاتك لا تظهر إلا داخل حسابك.</p>
        </div>
        <div className="auth-tabs" role="tablist">
          <button className={view === "login" ? "active" : ""} onClick={() => setView("login")}>تسجيل الدخول</button>
          <button className={view === "register" ? "active" : ""} onClick={() => setView("register")}>حساب جديد</button>
        </div>

        {notice ? <p className="form-notice success">{notice}</p> : null}
        {error ? <p className="form-notice error">{error}</p> : null}

        {view === "login" ? (
          <form className="auth-form" onSubmit={submitLogin}>
            <label>البريد الإلكتروني<input name="email" type="email" autoComplete="email" required /></label>
            <label>كلمة المرور<input name="password" type="password" autoComplete="current-password" required /></label>
            <button className="primary-action" disabled={busy}>{busy ? "جارٍ التحقق…" : "دخول آمن"}</button>
          </form>
        ) : (
          <form className="auth-form registration-grid" onSubmit={submitRegistration}>
            <label>الاسم الكامل<input name="fullName" required minLength={2} /></label>
            <label>البريد الإلكتروني<input name="email" type="email" required /></label>
            <label>كلمة المرور<input name="password" type="password" required minLength={8} placeholder="حرف كبير وصغير ورقم" /></label>
            <label>اسم المكتب<input name="officeName" required /></label>
            <label>حجم الفريق
              <select name="teamSize" defaultValue="solo">
                <option value="solo">فردي</option><option value="small">صغير</option>
                <option value="medium">متوسط</option><option value="large">كبير</option>
              </select>
            </label>
            <label>رقم القيد<input name="barAssociationNumber" /></label>
            <button className="primary-action" disabled={busy}>{busy ? "جارٍ الإرسال…" : "إرسال طلب التسجيل"}</button>
          </form>
        )}
        <p className="academic-note">مشروع أكاديمي — لا تُرسل مستندات حقيقية أثناء العرض التجريبي.</p>
      </section>
    </main>
  );
}

function SourceList({ sources }: { sources: SourceSnapshot[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;
  return (
    <div className="sources">
      <button className="sources-trigger" onClick={() => setOpen((value) => !value)}>
        <BookOpenText size={16} />
        {sources.length} {sources.length === 1 ? "مصدر محفوظ" : "مصادر محفوظة"}
        <ChevronDown size={15} className={open ? "rotated" : ""} />
      </button>
      {open ? (
        <div className="source-ledger">
          {sources.map((source) => (
            <article key={`${source.sourceId}-${source.chunkId}`}>
              <span className="source-index">{source.sourceId}</span>
              <div>
                <h4>{source.authorityTitleOfficial ?? "مصدر قانوني محفوظ"}</h4>
                <p className="source-meta">
                  {source.articleNumber ? `المادة ${source.articleNumber}` : "دون رقم مادة"}
                  {" · "}{source.authorityStatus ?? "حالة غير محددة"}
                  {" · "}{source.authorityType ?? "مصدر"}
                </p>
                <blockquote>{source.excerpt}</blockquote>
                {source.officialSourceUrl ? <a href={source.officialSourceUrl} target="_blank" rel="noreferrer">فتح المصدر الرسمي</a> : null}
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MessageBubble({
  message,
  onRetry,
}: {
  message: ChatMessage;
  onRetry: (message: ChatMessage) => void;
}) {
  const assistant = message.role === "assistant";
  return (
    <article className={`message ${assistant ? "assistant" : "user"} ${message.status}`} dir={isArabic(message.content) ? "rtl" : "ltr"}>
      <div className="message-mark">{assistant ? <Scale size={16} /> : "أنت"}</div>
      <div className="message-body">
        <p>{message.status === "pending" ? "جارٍ فحص المصادر وصياغة الإجابة…" : message.content}</p>
        {message.status === "failed" ? (
          <button className="retry-button" onClick={() => onRetry(message)}><RefreshCw size={14} /> إعادة المحاولة</button>
        ) : null}
        {assistant ? <SourceList sources={message.source_snapshot ?? []} /> : null}
      </div>
    </article>
  );
}

function Workspace({
  user,
  onLogout,
}: {
  user: PublicUser;
  onLogout: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationCursor, setConversationCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesCursor, setMessagesCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [status, setStatus] = useState("");
  const failedPayloads = useRef(new Map<string, { content: string; key: string }>());
  const scrollAnchor = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(false);

  const loadConversations = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "20", status: "active" });
    if (cursor) params.set("cursor", cursor);
    const payload = await apiFetch<{ conversations: Conversation[]; next_cursor: string | null }>(`/conversations?${params}`);
    setConversations((current) => cursor ? [...current, ...payload.conversations] : payload.conversations);
    setConversationCursor(payload.next_cursor);
    if (!cursor && !selectedId && payload.conversations[0]) setSelectedId(payload.conversations[0].conversation_id);
  }, [selectedId]);

  useEffect(() => { void loadConversations().catch(() => setStatus("تعذر تحميل المحادثات.")); }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let cancelled = false;
    apiFetch<{ messages: ChatMessage[]; next_cursor: string | null }>(`/conversations/${selectedId}/messages?limit=50`)
      .then((payload) => {
        if (!cancelled) {
          setMessages(payload.messages);
          setMessagesCursor(payload.next_cursor);
        }
      })
      .catch(() => setStatus("تعذر تحميل رسائل المحادثة."));
    return () => { cancelled = true; };
  }, [selectedId]);

  useEffect(() => {
    if (shouldScroll.current) {
      scrollAnchor.current?.scrollIntoView({ behavior: "smooth" });
      shouldScroll.current = false;
    }
  }, [messages]);

  const createConversation = async () => {
    const conversation = await apiFetch<Conversation>("/conversations", {
      method: "POST",
      body: JSON.stringify({ title: "بحث قانوني جديد" }),
    });
    setConversations((current) => [conversation, ...current]);
    setSelectedId(conversation.conversation_id);
    setMessages([]);
    setSidebarOpen(false);
  };

  const send = async (
    content: string,
    idempotencyKey: string = crypto.randomUUID(),
  ) => {
    if (!selectedId || !content.trim() || sending) return;
    setSending(true);
    setDraft("");
    shouldScroll.current = true;
    const userTemp = `user-${idempotencyKey}`;
    const assistantTemp = `assistant-${idempotencyKey}`;
    const optimisticUser: ChatMessage = {
      message_id: userTemp,
      conversation_id: selectedId,
      role: "user",
      status: "completed",
      sequence: Number.MAX_SAFE_INTEGER - 1,
      content,
      idempotency_key: idempotencyKey,
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    const optimisticAssistant: ChatMessage = {
      message_id: assistantTemp,
      conversation_id: selectedId,
      role: "assistant",
      status: "pending",
      sequence: Number.MAX_SAFE_INTEGER,
      content: "",
      created_at: new Date().toISOString(),
      optimistic: true,
    };
    setMessages((current) => [...current, optimisticUser, optimisticAssistant]);
    try {
      const turn = await apiFetch<{ user_message: ChatMessage; assistant_message: ChatMessage }>(
        `/conversations/${selectedId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            content,
            idempotency_key: idempotencyKey,
            top_k: 5,
          }),
        },
      );
      setMessages((current) => current
        .filter((message) => message.message_id !== userTemp && message.message_id !== assistantTemp)
        .concat(turn.user_message, turn.assistant_message)
        .sort((a, b) => a.sequence - b.sequence));
      void loadConversations();
    } catch (cause) {
      failedPayloads.current.set(assistantTemp, { content, key: idempotencyKey });
      setMessages((current) => current.map((message) =>
        message.message_id === assistantTemp
          ? { ...message, status: "failed", content: cause instanceof ApiError ? cause.message : "تعذر إنشاء الإجابة." }
          : message));
    } finally {
      setSending(false);
    }
  };

  const retry = (message: ChatMessage) => {
    const payload = failedPayloads.current.get(message.message_id);
    if (!payload) return;
    setMessages((current) => current.filter((item) =>
      item.message_id !== message.message_id &&
      item.message_id !== `user-${payload.key}`));
    void send(payload.content, payload.key);
  };

  const modifyConversation = async (conversation: Conversation, action: "rename" | "archive" | "delete") => {
    if (action === "rename") {
      const title = window.prompt("العنوان الجديد", conversation.title)?.trim();
      if (!title) return;
      const updated = await apiFetch<Conversation>(`/conversations/${conversation.conversation_id}`, {
        method: "PATCH", body: JSON.stringify({ title }),
      });
      setConversations((current) => current.map((item) => item.conversation_id === updated.conversation_id ? updated : item));
      return;
    }
    if (action === "delete" && !window.confirm("حذف هذه المحادثة من القائمة؟")) return;
    await apiFetch(`/conversations/${conversation.conversation_id}`, action === "archive"
      ? { method: "PATCH", body: JSON.stringify({ status: "archived" }) }
      : { method: "DELETE" });
    setConversations((current) => current.filter((item) => item.conversation_id !== conversation.conversation_id));
    if (selectedId === conversation.conversation_id) {
      setSelectedId(null);
      setMessages([]);
    }
  };

  const selected = conversations.find((item) => item.conversation_id === selectedId);

  return (
    <main className="workspace">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-seal small"><Scale size={21} /></div>
          <div><strong>ليجال مايند</strong><small>غرفة البحث</small></div>
          <button className="icon-button mobile-close" onClick={() => setSidebarOpen(false)} aria-label="إغلاق"><X size={19} /></button>
        </div>
        <button className="new-chat" onClick={() => void createConversation()}><Plus size={18} /> بحث جديد</button>
        <div className="sidebar-label"><span>المحادثات النشطة</span><Search size={14} /></div>
        <nav className="conversation-list">
          {conversations.map((conversation) => (
            <div key={conversation.conversation_id} className={`conversation-row ${selectedId === conversation.conversation_id ? "selected" : ""}`}>
              <button className="conversation-main" onClick={() => { setSelectedId(conversation.conversation_id); setSidebarOpen(false); }}>
                <MessageSquare size={16} />
                <span><strong>{conversation.title}</strong><small>{formatDate(conversation.last_message_at)}</small></span>
              </button>
              <details>
                <summary aria-label="خيارات المحادثة"><MoreHorizontal size={16} /></summary>
                <div className="conversation-menu">
                  <button onClick={() => void modifyConversation(conversation, "rename")}>إعادة تسمية</button>
                  <button onClick={() => void modifyConversation(conversation, "archive")}><Archive size={13} /> أرشفة</button>
                  <button className="danger" onClick={() => void modifyConversation(conversation, "delete")}><Trash2 size={13} /> حذف</button>
                </div>
              </details>
            </div>
          ))}
        </nav>
        {conversationCursor ? <button className="load-more" onClick={() => void loadConversations(conversationCursor)}>عرض المزيد</button> : null}
        <div className="sidebar-user">
          <div className="user-monogram">{user.fullName.slice(0, 1)}</div>
          <span><strong>{user.fullName}</strong><small>{user.email}</small></span>
          <button className="icon-button" onClick={onLogout} aria-label="تسجيل الخروج"><LogOut size={17} /></button>
        </div>
      </aside>

      <section className="research-room">
        <header className="research-header">
          <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="القائمة"><Menu size={20} /></button>
          <div><p className="case-number">EG / LEGAL RESEARCH</p><h2>{selected?.title ?? "مساحة بحث جديدة"}</h2></div>
          <div className="jurisdiction"><span>EG</span> القانون المصري</div>
        </header>

        <div className="message-scroll">
          {messagesCursor ? <button className="load-more centered" onClick={async () => {
            if (!selectedId) return;
            const payload = await apiFetch<{ messages: ChatMessage[]; next_cursor: string | null }>(`/conversations/${selectedId}/messages?limit=50&cursor=${encodeURIComponent(messagesCursor)}`);
            setMessages((current) => [...current, ...payload.messages]);
            setMessagesCursor(payload.next_cursor);
          }}>تحميل رسائل إضافية</button> : null}
          {messages.length === 0 ? (
            <div className="empty-state">
              <FileBadge size={28} strokeWidth={1.4} />
              <p className="eyebrow">مذكرة بحث جديدة</p>
              <h3>ابدأ بسؤال محدد، ثم تابع من حيث انتهيت.</h3>
              <p>مثال: ما شروط فصل العامل في القانون المصري؟</p>
            </div>
          ) : messages.map((message) => <MessageBubble key={message.message_id} message={message} onRetry={retry} />)}
          <div ref={scrollAnchor} />
        </div>

        <footer className="composer-wrap">
          {status ? <button className="status-strip" onClick={() => setStatus("")}>{status}<X size={13} /></button> : null}
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(draft); }
            }} placeholder="اكتب سؤالك القانوني أو سؤال المتابعة…" rows={1} disabled={!selectedId || sending} />
            <button disabled={!selectedId || !draft.trim() || sending} aria-label="إرسال"><ArrowUp size={20} /></button>
          </form>
          <p className="legal-notice">LegalMind مساعد أكاديمي للبحث القانوني. تحقّق من النتائج المهمة بالرجوع إلى المصادر الرسمية والحديثة قبل الاعتماد عليها.</p>
        </footer>
      </section>
    </main>
  );
}

function SessionApp() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    refreshAccessToken().then(setUser).catch(() => setUser(null)).finally(() => setBooting(false));
  }, []);

  if (booting) {
    return <div className="boot-screen"><div className="brand-seal"><Scale size={28} /></div><span>جارٍ فتح السجل الآمن…</span></div>;
  }
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return <Workspace user={user} onLogout={() => {
    void logout().finally(() => setUser(null));
  }} />;
}

export function App() {
  if (window.location.pathname.replace(/\/+$/, "") === "/verify-email") {
    return (
      <EmailVerificationScreen
        token={new URLSearchParams(window.location.search).get("token")}
      />
    );
  }
  return <SessionApp />;
}
