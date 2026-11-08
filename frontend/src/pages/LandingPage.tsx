import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Check,
  FileCheck2,
  Fingerprint,
  LockKeyhole,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import "./LandingPage.css";

const workflowSteps = [
  {
    number: "01",
    label: "Preserve",
    title: "Start with consent.",
    description:
      "Review what the process does, choose what to share, and continue at your own pace.",
    icon: LockKeyhole,
    status: "You stay in control",
    visual: "/images/shieldher-dawn.png",
    visualAlt: "A calm sunrise over a quiet landscape",
  },
  {
    number: "02",
    label: "Understand",
    title: "See the evidence in context.",
    description:
      "Explore image quality, forensic signals, and analysis notes together—not as a verdict.",
    icon: Search,
    status: "Signals, clearly explained",
    visual: "/images/shieldher-orbit.png",
    visualAlt: "A luminous network surrounding a glass sphere",
  },
  {
    number: "03",
    label: "Decide",
    title: "Choose what happens next.",
    description:
      "Review your case, decide whether to search further, and approve any draft yourself.",
    icon: FileCheck2,
    status: "No automatic submission",
    visual: "/loginhero.jpeg",
    visualAlt: "ShieldHer's digital safety artwork",
  },
];

const capabilities = [
  {
    icon: Fingerprint,
    title: "Evidence with context",
    description:
      "Keep original file details and analysis notes together in a case workspace.",
  },
  {
    icon: Search,
    title: "Understandable analysis",
    description:
      "Bring quality checks and forensic signals into one guided review.",
  },
  {
    icon: BadgeCheck,
    title: "A human decision stays central",
    description:
      "Review findings and drafts before deciding whether to take another step.",
  },
];

function BrandMark() {
  return (
    <span className="investor-brand-mark" aria-hidden="true">
      <Shield size={22} strokeWidth={2.2} />
      <span />
    </span>
  );
}

function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: reduceMotion ? 0 : 0.55, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const currentStep = workflowSteps[activeStep];
  const StepIcon = currentStep.icon;
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
        if (!visibleEntry) return;

        const index = stepRefs.current.findIndex(
          (step) => step === visibleEntry.target,
        );
        if (index >= 0) setActiveStep(index);
      },
      {
        rootMargin: "-40% 0px -40% 0px",
        threshold: 0,
      },
    );

    stepRefs.current.forEach((step) => {
      if (step) observer.observe(step);
    });

    return () => observer.disconnect();
  }, []);

  const selectStep = (index: number) => {
    setActiveStep(index);
    stepRefs.current[index]?.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
  };

  return (
    <div className="investor-page">
      <a className="investor-skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="investor-header">
        <Link className="investor-brand" to="/" aria-label="ShieldHer home">
          <BrandMark />
          <span>ShieldHer</span>
        </Link>

        <nav className="investor-nav" aria-label="Main navigation">
          <a href="#workflow">How it works</a>
          <a href="#principles">Our principles</a>
          <a href="#capabilities">Platform</a>
        </nav>

        <div className="investor-header-actions">
          <Link className="investor-signin" to="/login">
            Sign in
          </Link>
          <Link className="investor-button investor-button-small" to="/register">
            Create an account <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main-content">
        <section className="investor-hero" aria-labelledby="hero-title">
          <div className="investor-hero-glow investor-hero-glow-one" />
          <div className="investor-hero-glow investor-hero-glow-two" />
          <div className="investor-hero-grid" aria-hidden="true" />

          <div className="investor-hero-inner">
            <motion.div
              className="investor-hero-copy"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.65 }}
            >
              <div className="investor-eyebrow investor-eyebrow-light">
                <span className="investor-live-dot" />
                A PRIVATE, CONSENT-LED EVIDENCE WORKSPACE
              </div>
              <h1 id="hero-title">
                Clarity for a difficult moment.
                <span> Control at every step.</span>
              </h1>
              <p className="investor-hero-description">
                ShieldHer brings evidence, image analysis, and next-step
                guidance into one calm, private workspace—so people can make
                informed choices on their own terms.
              </p>

              <div className="investor-hero-actions">
                <Link className="investor-button" to="/register">
                  Explore the workspace <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <a className="investor-text-button" href="#workflow">
                  See how it works <ArrowDown size={16} aria-hidden="true" />
                </a>
              </div>

              <div className="investor-trust-note">
                <ShieldCheck size={17} aria-hidden="true" />
                <span>Analysis supports review; it does not replace judgment.</span>
              </div>
            </motion.div>

            <motion.div
              className="investor-product-preview"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.7, delay: 0.12 }}
              aria-label="Illustrative product interface preview"
            >
              <div className="investor-preview-topbar">
                <div className="investor-window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span>SHIELDHER / PRIVATE WORKSPACE</span>
                <LockKeyhole size={15} aria-hidden="true" />
              </div>

              <div className="investor-preview-content">
                <div className="investor-preview-heading">
                  <div>
                    <span className="investor-preview-kicker">YOUR WORKSPACE</span>
                    <h2>Evidence, at your pace.</h2>
                  </div>
                  <span className="investor-preview-avatar" aria-hidden="true">
                    S
                  </span>
                </div>

                <div className="investor-preview-case">
                  <div className="investor-preview-art">
                    <img
                      src="/images/shieldher-orbit.png"
                      alt=""
                      aria-hidden="true"
                    />
                    <div className="investor-preview-art-overlay">
                      <ShieldCheck size={22} aria-hidden="true" />
                    </div>
                  </div>
                  <div className="investor-preview-case-info">
                    <span className="investor-preview-kicker">
                      GUIDED REVIEW
                    </span>
                    <strong>Your case, organized</strong>
                    <span>Evidence and notes in one place</span>
                    <div className="investor-preview-progress">
                      <span />
                    </div>
                    <small>Move forward only when you are ready</small>
                  </div>
                </div>

                <div className="investor-preview-footer">
                  <span>
                    <span className="investor-preview-status-dot" />
                    Private workspace
                  </span>
                  <span>Consent comes first</span>
                </div>
              </div>

              <motion.div
                className="investor-floating-note"
                animate={
                  reduceMotion
                    ? undefined
                    : { y: [0, -6, 0], rotate: [0, -1, 0] }
                }
                transition={
                  reduceMotion
                    ? undefined
                    : { duration: 5, repeat: Infinity, ease: "easeInOut" }
                }
              >
                <span className="investor-floating-icon">
                  <Sparkles size={16} aria-hidden="true" />
                </span>
                <span>
                  <strong>Your choice, always</strong>
                  <small>Review before you proceed</small>
                </span>
              </motion.div>
            </motion.div>

            <div className="investor-hero-caption">
              <span>01</span>
              <span>PRIVATE SUPPORT, BUILT AROUND PEOPLE</span>
              <span className="investor-caption-line" />
              <span>PRODUCT OVERVIEW</span>
            </div>
          </div>
        </section>

        <section
          className="investor-workflow investor-section"
          id="workflow"
          aria-labelledby="workflow-title"
        >
          <Reveal className="investor-section-intro">
            <div className="investor-eyebrow">
              <span className="investor-eyebrow-index">01</span>
              A CLEARER WAY FORWARD
            </div>
            <h2 id="workflow-title">
              A thoughtful process.
              <span> One step at a time.</span>
            </h2>
            <p>
              The experience turns a complex set of tools into a guided journey.
              People can understand what each step means before they choose to
              continue.
            </p>
          </Reveal>

          <div className="investor-insights-grid">
            <div
              className="investor-insights-list"
              role="group"
              aria-label="ShieldHer workflow"
            >
              {workflowSteps.map((step, index) => {
                const Icon = step.icon;
                const isActive = activeStep === index;
                return (
                  <article
                    key={step.number}
                    ref={(element) => {
                      stepRefs.current[index] = element;
                    }}
                    className={`investor-insight-row${isActive ? " is-active" : ""}`}
                  >
                    <button
                      className="investor-insight-trigger"
                      type="button"
                      aria-expanded={isActive}
                      aria-controls={`workflow-detail-${index}`}
                      onClick={() => selectStep(index)}
                    >
                      <span className="investor-insight-icon">
                        <Icon size={19} aria-hidden="true" />
                      </span>
                      <span className="investor-insight-label">
                        <small>STEP {step.number}</small>
                        <strong>{step.label}</strong>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          id={`workflow-detail-${index}`}
                          className="investor-insight-detail"
                          initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: reduceMotion ? 0 : 0.3 }}
                        >
                          <p>{step.description}</p>
                          <span>
                            <Check size={14} aria-hidden="true" />
                            {step.status}
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </article>
                );
              })}
            </div>

            <div
              className="investor-insights-visual"
              role="region"
              aria-label={`${currentStep.label} visual preview`}
              aria-live="polite"
            >
              <AnimatePresence initial={false}>
                <motion.div
                  className="investor-insights-image"
                  key={currentStep.visual}
                  initial={reduceMotion ? false : { opacity: 0, scale: 1.035 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  transition={{ duration: reduceMotion ? 0 : 0.45, ease: "easeOut" }}
                >
                  <img src={currentStep.visual} alt={currentStep.visualAlt} />
                  <div className="investor-insights-image-shade" />
                  <div className="investor-insights-image-topline">
                    <span>THE SHIELDHER APPROACH</span>
                    <span>{currentStep.number} / 03</span>
                  </div>
                  <div className="investor-insights-image-caption">
                    <span className="investor-insights-image-icon">
                      <StepIcon size={19} aria-hidden="true" />
                    </span>
                    <span className="investor-insights-image-label">
                      {currentStep.label}, on your terms
                    </span>
                    <h3>{currentStep.title}</h3>
                    <p>{currentStep.description}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="investor-insights-progress" aria-hidden="true">
                {workflowSteps.map((step, index) => (
                  <span
                    className={index === activeStep ? "is-active" : ""}
                    key={step.number}
                  />
                ))}
              </div>
              <p className="investor-prototype-caption">
                Interactive product concept · sample content, not a live case
              </p>
            </div>
          </div>
        </section>

        <section
          className="investor-principles"
          id="principles"
          aria-labelledby="principles-title"
        >
          <div className="investor-principles-inner">
            <Reveal className="investor-principles-copy">
              <div className="investor-eyebrow investor-eyebrow-light">
                <span className="investor-eyebrow-index">02</span>
                TRUST IS A PRODUCT DECISION
              </div>
              <h2 id="principles-title">
                Built for sensitive moments.
                <span> Designed for trust.</span>
              </h2>
              <p>
                A calmer interface is only the beginning. Clear consent,
                understandable feedback, and human control are part of the
                product experience.
              </p>
              <Link className="investor-principles-link" to="/help">
                Explore safety and support <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </Reveal>

            <div className="investor-principle-cards">
              <Reveal className="investor-principle-card" delay={0.05}>
                <span className="investor-principle-icon">
                  <LockKeyhole size={20} aria-hidden="true" />
                </span>
                <span className="investor-card-index">01 / CONSENT</span>
                <h3>Choices stay visible.</h3>
                <p>
                  Explain what an action does before asking someone to take it.
                </p>
              </Reveal>
              <Reveal className="investor-principle-card" delay={0.12}>
                <span className="investor-principle-icon">
                  <Search size={20} aria-hidden="true" />
                </span>
                <span className="investor-card-index">02 / CLARITY</span>
                <h3>Signals need context.</h3>
                <p>
                  Present analysis as information to review, never as a final
                  verdict.
                </p>
              </Reveal>
              <Reveal className="investor-principle-card" delay={0.19}>
                <span className="investor-principle-icon">
                  <FileCheck2 size={20} aria-hidden="true" />
                </span>
                <span className="investor-card-index">03 / AGENCY</span>
                <h3>People decide what is next.</h3>
                <p>
                  Keep searches, reports, and sharing behind explicit user
                  choices.
                </p>
              </Reveal>
            </div>
          </div>
        </section>

        <section
          className="investor-capabilities investor-section"
          id="capabilities"
          aria-labelledby="capabilities-title"
        >
          <Reveal className="investor-capabilities-heading">
            <div>
              <div className="investor-eyebrow">
                <span className="investor-eyebrow-index">03</span>
                ONE CONNECTED WORKSPACE
              </div>
              <h2 id="capabilities-title">
                From first review
                <span> to next step.</span>
              </h2>
            </div>
            <p>
              A single interface connects a guided image review to case
              management, safety resources, and report drafting.
            </p>
          </Reveal>

          <div className="investor-capability-grid">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <Reveal
                  className="investor-capability-card"
                  key={capability.title}
                  delay={index * 0.08}
                >
                  <span className="investor-capability-icon">
                    <Icon size={21} aria-hidden="true" />
                  </span>
                  <span className="investor-card-index">
                    PLATFORM / 0{index + 1}
                  </span>
                  <h3>{capability.title}</h3>
                  <p>{capability.description}</p>
                </Reveal>
              );
            })}
          </div>
        </section>

        <section className="investor-closing" aria-labelledby="closing-title">
          <div className="investor-closing-glow" aria-hidden="true" />
          <Reveal className="investor-closing-content">
            <div className="investor-eyebrow investor-eyebrow-light">
              <span className="investor-live-dot" />
              BEGIN WHEN YOU FEEL READY
            </div>
            <h2 id="closing-title">
              Make space for clarity.
              <span> Keep the next step yours.</span>
            </h2>
            <p>
              Explore the workspace and decide what support looks like for you.
            </p>
            <div className="investor-closing-actions">
              <Link className="investor-button" to="/register">
                Create a private account <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link className="investor-closing-signin" to="/login">
                Already have an account? Sign in
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="investor-footer">
        <Link className="investor-brand" to="/" aria-label="ShieldHer home">
          <BrandMark />
          <span>ShieldHer</span>
        </Link>
        <p>A private, consent-led evidence workspace.</p>
        <nav aria-label="Footer navigation">
          <a href="#workflow">How it works</a>
          <Link to="/help">Help &amp; Safety</Link>
          <Link to="/reviewer">Reviewer portal</Link>
          <Link to="/health">System status</Link>
        </nav>
        <small>© {new Date().getFullYear()} ShieldHer</small>
      </footer>
    </div>
  );
}
