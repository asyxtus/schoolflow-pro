import { useId } from "react";
import { Input } from "@/components/ui/input";

export function SubjectPicker({
  value,
  onChange,
  subjects,
  placeholder,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  subjects: { id: string; name: string }[];
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  return (
    <>
      <Input
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Mathematics"}
        className={className}
      />
      <datalist id={listId}>
        {subjects.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>
    </>
  );
}
