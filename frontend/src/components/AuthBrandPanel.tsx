import { Link } from "react-router-dom";
import { FileCheck2, LockKeyhole, Shield, UserRoundCheck } from "lucide-react";

interface AuthBrandPanelProps {
  title: string;
  description: string;
}

const principles = [
  { icon: LockKeyhole, text: "Choices are clear before you continue" },
  { icon: FileCheck2, text: "Analysis stays in context, not as a verdict" },
  { icon: UserRoundCheck, text: "You decide whether to take another step" },
];

export default function AuthBrandPanel({
  title,
  description,
}: AuthBrandPanelProps) {
  return (
    <aside className="auth-brand-panel lg:col-span-5">
      <Link to="/" className="auth-panel-brand" aria-label="ShieldHer home">
        <span className="auth-panel-mark">
          <Shield size={19} aria-hidden="true" />
        </span>
        <span>ShieldHer</span>
      </Link>

      <div className="auth-panel-copy">
        <p className="auth-panel-eyebrow">Private evidence workspace</p>
        <h2>{title}</h2>
        <p className="auth-panel-description">{description}</p>
        <ul>
          {principles.map(({ icon: Icon, text }) => (
            <li key={text}>
              <Icon size={17} aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="auth-panel-note">
        Help and safety resources are available whenever you need them.
      </p>
    </aside>
  );
}
