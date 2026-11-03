import { useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  PhoneCall,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  AlertCircle,
} from "lucide-react";

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "What should I do first if an intimate image was shared without my consent?",
      a: "Try to stay as calm as possible. Avoid engaging with or threatening the person sharing the image, as this can sometimes trigger wider distribution. Before blocking accounts or deleting messages, preserve screenshots that show the image, date, time, and account handle.",
    },
    {
      q: "How does ShieldHer handle the images I upload?",
      a: "Images uploaded to ShieldHer are sent to our private, isolated server instance solely to run the detection models (face detection, face manipulation, and synthetic generation). We do not sell your data, train public commercial AI models on your photos, or send your photos to external search engines without your explicit opt-in.",
    },
    {
      q: "Can ShieldHer guarantee that an image will be removed from the internet?",
      a: "No platform can legally guarantee complete removal from every corner of the internet. ShieldHer helps you verify manipulation, document evidence with immutable timestamps, and prepare formal legal complaints so law enforcement and platform intermediaries can process takedown orders.",
    },
    {
      q: "How can I delete my requests or account data?",
      a: "You have complete control over your records. You can delete any individual request directly from its request page, or visit Account & Privacy to purge all session records.",
    },
    {
      q: "What is StopNCII.org and TakeItDown?",
      a: "StopNCII.org (for adults) and TakeItDown (for anyone who was under 18 when the image was taken) are free platforms that generate a digital hash (fingerprint) of an image on your device. Participating tech companies use these hashes to detect and block matching images from being uploaded to their services.",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pb-10"
    >
      {/* Intro Panel */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-sage/40 border border-brand-border text-brand-forest text-xs font-semibold mb-3">
          <HeartHandshake className="w-3.5 h-3.5 text-accent-gold" />
          <span>Trauma-Informed Support & Guidance</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight font-heading">
          Help & Safety
        </h2>
        <p className="text-xs sm:text-sm text-ink-secondary mt-1.5 leading-relaxed max-w-2xl font-sans">
          If someone is sharing or threatening to share personal imagery without
          your consent, you are not alone. Here are practical, calm steps you can
          take to protect yourself and seek help.
        </p>
      </div>

      {/* Immediate Steps Guide */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-ink font-heading">
            What to Do If an Intimate Image is Shared
          </h3>
          <p className="text-xs text-ink-secondary mt-0.5 font-sans">
            Key steps to take right now to protect yourself and preserve vital
            information.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
                <Camera className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                1. Preserve Evidence First
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Take full-screen screenshots of the messages, profile handles,
                phone numbers, and URLs where the media was posted before blocking
                or reporting. Capture the visible date and time.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-accent-coralSoft text-accent-coral flex items-center justify-center mb-3.5 border border-accent-coral/30">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                2. Do Not Pay or Yield
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                If someone is blackmailing you for money or additional content,
                paying rarely stops them from asking for more. Preserve the
                messages, disconnect communications, and seek official help.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#FAF8F5] border border-ink-border/80 flex flex-col justify-between shadow-2xs">
            <div>
              <div className="w-10 h-10 rounded-xl bg-brand-sage/40 text-brand-forest flex items-center justify-center mb-3.5 border border-brand-border">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-ink font-heading">
                3. Check & Document
              </h4>
              <p className="text-xs text-ink-secondary mt-1.5 leading-relaxed">
                Use ShieldHer to check whether the image has signs of AI
                generation or face manipulation, compute an immutable SHA-256
                digital receipt, and format a complaint draft.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Official Verified Helplines & Portals */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-5">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-ink font-heading">
            Verified Helplines & Reporting Portals
          </h3>
          <p className="text-xs text-ink-secondary mt-0.5 font-sans">
            Direct access to official cybercrime authorities and global hash-sharing
            prevention networks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 sm:p-6 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 transition-all flex flex-col justify-between shadow-2xs">
            <div>
              <strong className="text-sm font-bold text-ink font-heading block mb-1">
                National Cyber Crime Portal (India)
              </strong>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Dedicated government platform for reporting cybercrimes against
                women and children. Reports can be filed anonymously or with
                tracking.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-ink-border/60 flex items-center justify-between gap-2">
              <a
                href="https://cybercrime.gov.in"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-forest hover:text-brand-rich hover:underline"
              >
                <span>cybercrime.gov.in</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href="tel:1930"
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-coral hover:text-accent-coral/80"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call 1930</span>
              </a>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 transition-all flex flex-col justify-between shadow-2xs">
            <div>
              <strong className="text-sm font-bold text-ink font-heading block mb-1">
                StopNCII.org (Global)
              </strong>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Operated by the Revenge Porn Helpline. Creates a secure hash on
                your device to prevent sharing across platforms like Meta,
                TikTok, and Reddit.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-ink-border/60">
              <a
                href="https://stopncii.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-forest hover:text-brand-rich hover:underline"
              >
                <span>Visit StopNCII.org</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-2xl bg-surface-pearl border border-ink-border/80 hover:border-brand-rich/50 transition-all flex flex-col justify-between shadow-2xs">
            <div>
              <strong className="text-sm font-bold text-ink font-heading block mb-1">
                TakeItDown (NCMEC)
              </strong>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Free confidential service specifically for people who were under
                18 when the explicit media was created or shared.
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-ink-border/60">
              <a
                href="https://takeitdown.ncmec.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-forest hover:text-brand-rich hover:underline"
              >
                <span>Visit TakeItDown.org</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="bg-surface-pearl rounded-2xl border border-ink-border/80 p-6 sm:p-8 shadow-xs space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-ink font-heading">
            Frequently Asked Questions
          </h3>
          <p className="text-xs text-ink-secondary mt-0.5 font-sans">
            Answers to common questions about privacy, legal status, and evidence
            handling.
          </p>
        </div>

        <div className="space-y-2.5">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-ink-border/80 bg-[#FAF8F5] overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full text-left p-4 flex items-center justify-between gap-3 text-xs sm:text-sm font-bold text-ink hover:bg-[#F4F1EC] transition-colors font-heading"
              >
                <span>{faq.q}</span>
                {openFaq === idx ? (
                  <ChevronUp className="w-4 h-4 text-ink-muted flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-ink-muted flex-shrink-0" />
                )}
              </button>

              {openFaq === idx && (
                <div className="px-4 pb-4 pt-1 text-xs text-ink-secondary leading-relaxed border-t border-ink-border/40 font-sans">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Reassurance Alert */}
      <div className="p-4 sm:p-5 rounded-2xl bg-brand-sage/20 border border-brand-border flex items-start gap-3.5 text-xs text-ink-secondary leading-relaxed">
        <div className="w-8 h-8 rounded-xl bg-brand-sage/60 text-brand-forest flex items-center justify-center flex-shrink-0 mt-0.5 border border-brand-border">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div>
          <strong className="text-ink font-semibold">You are not alone:</strong>{" "}
          If you feel overwhelmed or are in immediate physical danger, please
          contact local emergency services or dial your country's emergency
          number (such as 112 in India / Europe or 911 in North America)
          immediately.
        </div>
      </div>
    </motion.div>
  );
}
