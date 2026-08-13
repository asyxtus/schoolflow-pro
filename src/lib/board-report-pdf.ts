import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type MonthPoint = { month: string; value: number };

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function generateBoardReportPdf(params: {
  snapshot: {
    schoolName: string;
    academicYear: string | null;
    activeStudents: number;
    activeStaff: number;
    openDisciplineIncidents: number;
    clinicVisitsLast30Days: number;
  };
  trends: {
    months: string[];
    enrollments: MonthPoint[];
    collections: MonthPoint[];
    attendanceRate: MonthPoint[];
    discipline: MonthPoint[];
    clinicVisits: MonthPoint[];
  };
}) {
  const { snapshot, trends } = params;
  const doc = new jsPDF({ unit: "pt" });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 48;

  doc.setFontSize(18);
  doc.text(snapshot.schoolName || "School Board Report", 40, y);
  y += 22;
  doc.setFontSize(10);
  doc.setTextColor(100);
  const meta = [
    snapshot.academicYear ? `Academic year ${snapshot.academicYear}` : null,
    `Generated ${new Date().toLocaleDateString()}`,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(meta, 40, y);
  doc.setTextColor(0);
  y += 24;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Value"]],
    body: [
      ["Active students", String(snapshot.activeStudents)],
      ["Active staff", String(snapshot.activeStaff)],
      ["Open discipline incidents", String(snapshot.openDisciplineIncidents)],
      ["Clinic visits (last 30 days)", String(snapshot.clinicVisitsLast30Days)],
    ],
    theme: "plain",
    styles: { fontSize: 10 },
    headStyles: { fontStyle: "bold" },
    margin: { left: 40, right: 40 },
    tableWidth: pageWidth - 80,
  });
  // @ts-expect-error autotable attaches lastAutoTable to the doc instance at runtime
  y = doc.lastAutoTable.finalY + 24;

  const section = (title: string, rows: MonthPoint[], format: (v: number) => string) => {
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 48;
    }
    doc.setFontSize(13);
    doc.text(title, 40, y);
    y += 10;
    autoTable(doc, {
      startY: y,
      head: [["Month", title]],
      body: rows.map((r) => [monthLabel(r.month), format(r.value)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 40, right: 40 },
      tableWidth: pageWidth - 80,
    });
    // @ts-expect-error autotable attaches lastAutoTable to the doc instance at runtime
    y = doc.lastAutoTable.finalY + 24;
  };

  section("New enrollments", trends.enrollments, (v) => String(v));
  section("Fee collections (FCFA)", trends.collections, (v) => v.toLocaleString());
  section("Attendance rate (%)", trends.attendanceRate, (v) => `${v}%`);
  section("Discipline incidents", trends.discipline, (v) => String(v));
  section("Clinic visits", trends.clinicVisits, (v) => String(v));

  const fileName = `${(snapshot.schoolName || "board-report").replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-board-report-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
