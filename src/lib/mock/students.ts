export type StudentStatus = "active" | "suspended" | "withdrawn" | "graduated";
export type FeeStatus = "paid" | "partial" | "overdue";

export type Student = {
  id: string;
  matricule: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  className: string;
  formMaster: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  address: string;
  status: StudentStatus;
  feeStatus: FeeStatus;
  feeBalance: number;
  attendanceRate: number;
  enrolledOn: string;
  religion?: string;
  bloodGroup?: string;
  emergencyContact?: string;
};

const CLASSES = [
  "Form 1A",
  "Form 1B",
  "Form 2A",
  "Form 3A",
  "Form 4 Science",
  "Form 5 Arts",
  "Lower Sixth Science",
  "Upper Sixth Arts",
];

const FORM_MASTERS = [
  "Mme. Ngoh Beatrice",
  "Mr. Tabi Emmanuel",
  "Mr. Njock Paul",
  "Mme. Fon Clarisse",
  "Mr. Achu Divine",
  "Mme. Eyong Sylvie",
  "Mr. Mbah Ivo",
  "Mme. Atem Rose",
];

const FIRST_NAMES_M = [
  "Achille",
  "Ivo",
  "Divine",
  "Emmanuel",
  "Paul",
  "Cedric",
  "Yannick",
  "Blaise",
  "Serge",
  "Landry",
  "Herve",
  "Joel",
  "Franck",
  "Marius",
];
const FIRST_NAMES_F = [
  "Beatrice",
  "Clarisse",
  "Sylvie",
  "Rose",
  "Marlyse",
  "Josiane",
  "Michelle",
  "Estelle",
  "Nadine",
  "Laure",
  "Amelie",
  "Cynthia",
  "Ingrid",
];
const LAST_NAMES = [
  "Ngoh",
  "Tabi",
  "Njock",
  "Fon",
  "Achu",
  "Eyong",
  "Mbah",
  "Atem",
  "Ekwe",
  "Nfor",
  "Tchouta",
  "Kamga",
  "Bikai",
  "Mbella",
  "Ndong",
  "Sama",
  "Ayissi",
  "Meka",
  "Tchamba",
  "Ndikum",
];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function pad(n: number, len = 4) {
  return n.toString().padStart(len, "0");
}

function makeStudents(): Student[] {
  const rand = seedRand(42);
  const list: Student[] = [];
  for (let i = 0; i < 42; i++) {
    const gender: "M" | "F" = rand() > 0.48 ? "M" : "F";
    const first =
      gender === "M"
        ? FIRST_NAMES_M[Math.floor(rand() * FIRST_NAMES_M.length)]
        : FIRST_NAMES_F[Math.floor(rand() * FIRST_NAMES_F.length)];
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)];
    const classIdx = Math.floor(rand() * CLASSES.length);
    const feeRoll = rand();
    const feeStatus: FeeStatus = feeRoll > 0.72 ? "overdue" : feeRoll > 0.42 ? "partial" : "paid";
    const feeBalance = feeStatus === "paid" ? 0 : Math.round(rand() * 220 + 25) * 1000;
    const statusRoll = rand();
    const status: StudentStatus =
      statusRoll > 0.96 ? "suspended" : statusRoll > 0.93 ? "withdrawn" : "active";
    const attendance = Math.round(78 + rand() * 21);
    const year = 2008 + Math.floor(rand() * 10);
    const month = 1 + Math.floor(rand() * 12);
    const day = 1 + Math.floor(rand() * 27);
    list.push({
      id: `stu-${pad(i + 1)}`,
      matricule: `SEC-2025-${pad(i + 1)}`,
      firstName: first,
      lastName: last,
      gender,
      dateOfBirth: `${year}-${pad(month, 2)}-${pad(day, 2)}`,
      className: CLASSES[classIdx],
      formMaster: FORM_MASTERS[classIdx],
      guardianName: `${gender === "M" ? "M." : "Mme."} ${LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]}`,
      guardianPhone: `+237 6${Math.floor(rand() * 90 + 70)} ${Math.floor(rand() * 900 + 100)} ${Math.floor(rand() * 900 + 100)}`,
      guardianEmail: rand() > 0.35 ? `guardian.${last.toLowerCase()}@example.cm` : undefined,
      address: `Quartier ${["Bonanjo", "Bastos", "Mvog-Ada", "Deido", "Nkolbisson", "Bonaberi"][Math.floor(rand() * 6)]}, ${rand() > 0.5 ? "Douala" : "Yaoundé"}`,
      status,
      feeStatus,
      feeBalance,
      attendanceRate: attendance,
      enrolledOn: `${2020 + Math.floor(rand() * 5)}-09-05`,
      religion: ["Catholic", "Protestant", "Muslim", "Traditional"][Math.floor(rand() * 4)],
      bloodGroup: ["O+", "A+", "B+", "AB+", "O-", "A-"][Math.floor(rand() * 6)],
      emergencyContact: `+237 6${Math.floor(rand() * 90 + 70)} ${Math.floor(rand() * 900 + 100)} ${Math.floor(rand() * 900 + 100)}`,
    });
  }
  return list;
}

export const STUDENTS = makeStudents();

export const CLASS_OPTIONS = ["all", ...CLASSES];

export function formatFCFA(n: number) {
  return (
    new Intl.NumberFormat("fr-FR", { useGrouping: true }).format(n).replace(/,/g, " ") + " FCFA"
  );
}

export function getStudent(id: string) {
  return STUDENTS.find((s) => s.id === id);
}
