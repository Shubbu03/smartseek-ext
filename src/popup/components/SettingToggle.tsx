type SettingToggleProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export default function SettingToggle({ id, label, description, checked, disabled, onChange }: SettingToggleProps) {
  return (
    <div className="setting-row">
      <div className="setting-copy">
        <label id={`${id}-label`} htmlFor={id}>{label}</label>
        <p id={`${id}-description`}>{description}</p>
      </div>
      <button id={id} type="button" className="setting-switch" role="switch" aria-checked={checked}
        aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} disabled={disabled}
        onClick={() => onChange(!checked)}><span aria-hidden="true" /></button>
    </div>
  );
}
