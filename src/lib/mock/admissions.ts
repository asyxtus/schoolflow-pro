export type AdmissionStage = "new" | "review" | "interview" | "offer" | "enrolled" | "rejected";

export type Applicant = {
  id: string;
  fullName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  desiredClass: string;
  previousSchool: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail?: string;
  submittedOn: string;
  stage: AdmissionStage;
  score?: number;
  notes?: string;
};

export const STAGES: { id: AdmissionStage; label: string; tone: string }[] = [
  { id: "new", label: "New enquiry", tone: "bg-muted text-foreground" },
  { id: "review", label: "Under review", tone: "bg-secondary text-secondary-foreground" },
  { id: "interview", label: "Interview", tone: "bg-accent/20 text-accent-foreground" },
  { id: "offer", label: "Offer sent", tone: "bg-primary/15 text-primary" },
  { id: "enrolled", label: "Enrolled", tone: "bg-primary text-primary-foreground" },
  { id: "rejected", label: "Rejected", tone: "bg-destructive/10 text-destructive" },
];

export const APPLICANTS: Applicant[] = [
  {
    id: "app-001",
    fullName: "Njoya Herve",
    gender: "M",
    dateOfBirth: "2013-04-11",
    desiredClass: "Form 1A",
    previousSchool: "Ecole Publique de Bonaberi",
    guardianName: "M. Njoya Bernard",
    guardianPhone: "+237 677 812 340",
    guardianEmail: "bernard.njoya@example.cm",
    submittedOn: "2026-06-14",
    stage: "new",
  },
  {
    id: "app-002",
    fullName: "Fongang Michelle",
    gender: "F",
    dateOfBirth: "2012-11-02",
    desiredClass: "Form 1B",
    previousSchool: "St. Joseph's Primary Buea",
    guardianName: "Mme. Fongang Estelle",
    guardianPhone: "+237 699 145 021",
    submittedOn: "2026-06-16",
    stage: "new",
  },
  {
    id: "app-003",
    fullName: "Etoundi Serge",
    gender: "M",
    dateOfBirth: "2011-07-25",
    desiredClass: "Form 2A",
    previousSchool: "College Vogt",
    guardianName: "M. Etoundi Jean",
    guardianPhone: "+237 655 902 118",
    guardianEmail: "j.etoundi@example.cm",
    submittedOn: "2026-06-10",
    stage: "review",
    score: 62,
  },
  {
    id: "app-004",
    fullName: "Tchamba Ingrid",
    gender: "F",
    dateOfBirth: "2010-01-18",
    desiredClass: "Form 3A",
    previousSchool: "Lycée de Nkolbisson",
    guardianName: "M. Tchamba Andre",
    guardianPhone: "+237 690 337 705",
    submittedOn: "2026-06-04",
    stage: "interview",
    score: 74,
    notes: "Strong in mathematics, interview scheduled for Friday.",
  },
  {
    id: "app-005",
    fullName: "Mbella Cedric",
    gender: "M",
    dateOfBirth: "2009-09-30",
    desiredClass: "Form 4 Science",
    previousSchool: "GBHS Deido",
    guardianName: "Mme. Mbella Christiane",
    guardianPhone: "+237 677 555 018",
    guardianEmail: "c.mbella@example.cm",
    submittedOn: "2026-05-28",
    stage: "interview",
    score: 81,
  },
  {
    id: "app-006",
    fullName: "Ayissi Nadine",
    gender: "F",
    dateOfBirth: "2008-03-12",
    desiredClass: "Form 5 Arts",
    previousSchool: "College de la Retraite",
    guardianName: "Mme. Ayissi Rose",
    guardianPhone: "+237 691 202 884",
    submittedOn: "2026-05-22",
    stage: "offer",
    score: 88,
    notes: "Offer letter sent 3 days ago. Awaiting acceptance.",
  },
  {
    id: "app-007",
    fullName: "Kamga Landry",
    gender: "M",
    dateOfBirth: "2007-12-08",
    desiredClass: "Lower Sixth Science",
    previousSchool: "Collège François-Xavier Vogt",
    guardianName: "M. Kamga Patrice",
    guardianPhone: "+237 655 411 060",
    guardianEmail: "p.kamga@example.cm",
    submittedOn: "2026-05-18",
    stage: "offer",
    score: 91,
  },
  {
    id: "app-008",
    fullName: "Sama Amelie",
    gender: "F",
    dateOfBirth: "2008-08-24",
    desiredClass: "Upper Sixth Arts",
    previousSchool: "Lycée Général Leclerc",
    guardianName: "M. Sama Blaise",
    guardianPhone: "+237 679 660 300",
    submittedOn: "2026-05-02",
    stage: "enrolled",
    score: 85,
  },
  {
    id: "app-009",
    fullName: "Bikai Franck",
    gender: "M",
    dateOfBirth: "2013-02-05",
    desiredClass: "Form 1A",
    previousSchool: "École Saint-Michel",
    guardianName: "M. Bikai Roland",
    guardianPhone: "+237 699 771 205",
    submittedOn: "2026-04-20",
    stage: "rejected",
    notes: "Insufficient primary school records.",
  },
];
