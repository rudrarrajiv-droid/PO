import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Users, IndianRupee, Loader2, X, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getEmployees, getAttendanceByDateRange, type Employee, type AttendanceRecord } from '../../lib/firebase/salaryServices';

export default function MonthlyReportTab() {
  const [fromDate, setFromDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [toDate, setToDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'COMPANY' | 'WAGES_DINESH' | 'WAGES_VIKAS'>('ALL');
  const [viewMode, setViewMode] = useState<'DATE' | 'EMPLOYEE'>('DATE');
  const [selectedEmployeeForLedger, setSelectedEmployeeForLedger] = useState<Employee | null>(null);

  useEffect(() => {
    fetchData();
  }, [fromDate, toDate]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [emps, rangeRecords] = await Promise.all([
        getEmployees(),
        getAttendanceByDateRange(fromDate, toDate)
      ]);
      setEmployees(emps);
      setRecords(rangeRecords);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      if (filter === 'ALL') return true;
      if (filter === 'COMPANY') return emp.category === 'COMPANY';
      if (filter === 'WAGES_DINESH') return emp.category === 'WAGES' && emp.contractorName === 'Dinesh';
      if (filter === 'WAGES_VIKAS') return emp.category === 'WAGES' && emp.contractorName === 'Vikas';
      return true;
    });
  }, [employees, filter]);

  const reportData = useMemo(() => {
    const data: any[] = [];
    
    filteredEmployees.forEach(emp => {
      // Filter records for this employee
      const empRecords = records.filter(r => r.employeeId === emp.id);
      
      const totalPresent = empRecords.reduce((sum, r) => sum + r.present, 0);
      const totalOTHours = empRecords.reduce((sum, r) => sum + r.otHours, 0);
      
      // REQUIREMENT: JIS EMPLOYEE KA EK BHI DAY ME PESENT YA OT NAHI HAI USKA NAAM SHOW NA HO
      if (totalPresent === 0 && totalOTHours === 0) {
        return;
      }

      const totalDaysAmount = Math.round(empRecords.reduce((sum, r) => sum + r.perDayAmount, 0));
      const totalOTAmount = Math.round(empRecords.reduce((sum, r) => sum + r.otAmount, 0));
      const totalRefreshment = Math.round(empRecords.reduce((sum, r) => sum + r.refreshment, 0));
      const grossSalary = totalDaysAmount + totalOTAmount + totalRefreshment;

      data.push({
        ...emp,
        totalPresent,
        totalOTHours,
        totalDaysAmount,
        totalOTAmount,
        totalRefreshment,
        grossSalary
      });
    });

    return data;
  }, [filteredEmployees, records]);

  const dateWiseData = useMemo(() => {
    const datesMap: Record<string, any> = {};
    
    // We only care about filtered records
    const relevantRecords = records.filter(r => filteredEmployees.some(emp => emp.id === r.employeeId));

    relevantRecords.forEach(r => {
      if (!datesMap[r.date]) {
        datesMap[r.date] = {
          date: r.date,
          companyCount: 0,
          dineshCount: 0,
          vikasCount: 0,
          totalDaysAmount: 0,
          totalOTAmount: 0,
          totalRefreshment: 0,
          grossSalary: 0
        };
      }
      
      const emp = filteredEmployees.find(e => e.id === r.employeeId);
      if (!emp) return;

      // Count if present > 0 (even half day counts as present for manpower count)
      if (r.present > 0) {
        if (emp.category === 'COMPANY') datesMap[r.date].companyCount++;
        else if (emp.contractorName === 'Dinesh') datesMap[r.date].dineshCount++;
        else if (emp.contractorName === 'Vikas') datesMap[r.date].vikasCount++;
      }

      datesMap[r.date].totalDaysAmount += r.perDayAmount;
      datesMap[r.date].totalOTAmount += r.otAmount;
      datesMap[r.date].totalRefreshment += r.refreshment;
      datesMap[r.date].grossSalary += (r.perDayAmount + r.otAmount + r.refreshment);
    });

    return Object.values(datesMap).sort((a: any, b: any) => a.date.localeCompare(b.date)).map((d: any) => ({
      ...d,
      totalDaysAmount: Math.round(d.totalDaysAmount),
      totalOTAmount: Math.round(d.totalOTAmount),
      totalRefreshment: Math.round(d.totalRefreshment),
      grossSalary: Math.round(d.grossSalary)
    }));
  }, [records, filteredEmployees]);

  const handleExportExcel = () => {
    if (viewMode === 'EMPLOYEE') {
      if (reportData.length === 0) {
        alert("No data available to export for this period.");
        return;
      }
      const exportData = reportData.map(row => ({
        Category: row.category === 'COMPANY' ? 'Company' : `Wages (${row.contractorName || ''})`,
        "Employee Name": row.name,
        Designation: row.designation,
        "Basic Salary": row.basicSalary,
        "Total Days": row.totalPresent,
        "Days Amount": row.totalDaysAmount,
        "Total OT (Hrs)": row.totalOTHours,
        "OT Amount": row.totalOTAmount,
        "Refreshment": row.totalRefreshment,
        "Gross Salary": row.grossSalary
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Salary Report");
      XLSX.writeFile(workbook, `Salary_Report_${fromDate}_to_${toDate}_${filter}.xlsx`);
    } else {
      if (dateWiseData.length === 0) {
        alert("No data available to export for this period.");
        return;
      }
      const exportData = dateWiseData.map(row => ({
        Date: new Date(row.date).toLocaleDateString('en-GB'),
        "Company Count": row.companyCount,
        "Dinesh Count": row.dineshCount,
        "Vikas Count": row.vikasCount,
        "Days Amount": row.totalDaysAmount,
        "OT Amount": row.totalOTAmount,
        "Refreshment": row.totalRefreshment,
        "Gross Salary": row.grossSalary
      }));
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Date_Wise_Salary");
      XLSX.writeFile(workbook, `Date_Wise_Salary_${fromDate}_to_${toDate}_${filter}.xlsx`);
    }
  };

  const thClass = "px-3 py-3 border-b border-border text-left font-medium text-muted-foreground whitespace-nowrap";
  const tdClass = "px-3 py-3 border-b border-border";

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-card p-4 rounded-lg border border-border shadow-sm gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Salary & Wages Report</h2>
          <p className="text-sm text-muted-foreground">Aggregated view of employee attendance and salary for selected period</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border">
            <button
              onClick={() => setViewMode('DATE')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'DATE' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Date Wise
            </button>
            <button
              onClick={() => setViewMode('EMPLOYEE')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${viewMode === 'EMPLOYEE' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              Employee Wise
            </button>
          </div>
          <button
            onClick={handleExportExcel}
            className="flex items-center px-4 py-2 bg-secondary text-secondary-foreground font-medium rounded-lg hover:bg-secondary/80 transition-colors shadow-sm"
          >
            <FileDown className="w-5 h-5 mr-2" />
            Export Excel
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">From:</span>
            <input 
              type="date" 
              className="px-3 py-2 border border-input rounded-lg bg-background font-medium shadow-sm text-sm"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground font-medium">To:</span>
            <input 
              type="date" 
              className="px-3 py-2 border border-input rounded-lg bg-background font-medium shadow-sm text-sm"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {(['ALL', 'COMPANY', 'WAGES_DINESH', 'WAGES_VIKAS'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              filter === f 
                ? 'bg-primary text-primary-foreground border-primary' 
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'COMPANY' ? 'Company' : f === 'WAGES_DINESH' ? 'Wages (Dinesh)' : 'Wages (Vikas)'}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          {viewMode === 'DATE' ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className={thClass}>Date</th>
                  <th className={thClass}>Company Count</th>
                  <th className={thClass}>Dinesh Count</th>
                  <th className={thClass}>Vikas Count</th>
                  <th className={thClass}>Total Days Amount</th>
                  <th className={thClass}>Total OT Amount</th>
                  <th className={thClass}>Total Refreshment</th>
                  <th className={thClass}>Grand Total</th>
                </tr>
              </thead>
              {/* Grand Totals at Top for Date View */}
              {!isLoading && dateWiseData.length > 0 && (
                <tbody className="bg-muted/30 border-b-2 border-border font-bold">
                  <tr>
                    <td className="px-3 py-4 text-right text-foreground uppercase tracking-wider">Grand Total</td>
                    <td className="px-3 py-4 text-primary">{dateWiseData.reduce((sum, r) => sum + r.companyCount, 0)}</td>
                    <td className="px-3 py-4 text-primary">{dateWiseData.reduce((sum, r) => sum + r.dineshCount, 0)}</td>
                    <td className="px-3 py-4 text-primary">{dateWiseData.reduce((sum, r) => sum + r.vikasCount, 0)}</td>
                    <td className="px-3 py-4 text-foreground">₹{dateWiseData.reduce((sum, r) => sum + r.totalDaysAmount, 0)}</td>
                    <td className="px-3 py-4 text-foreground">₹{dateWiseData.reduce((sum, r) => sum + r.totalOTAmount, 0)}</td>
                    <td className="px-3 py-4 text-foreground">₹{dateWiseData.reduce((sum, r) => sum + r.totalRefreshment, 0)}</td>
                    <td className="px-3 py-4 text-green-700 bg-green-100/50">
                      <div className="flex items-center">
                        <IndianRupee className="w-4 h-4 mr-1" />
                        {dateWiseData.reduce((sum, r) => sum + r.grossSalary, 0)}
                      </div>
                    </td>
                  </tr>
                </tbody>
              )}
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Calculating date-wise report...
                    </td>
                  </tr>
                ) : dateWiseData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-muted-foreground">
                      <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No attendance records found from {fromDate} to {toDate}.
                    </td>
                  </tr>
                ) : (
                  dateWiseData.map((row, index) => (
                    <tr key={index} className="hover:bg-muted/50 transition-colors">
                      <td className={`${tdClass} font-bold text-foreground`}>
                        {new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className={`${tdClass} font-semibold text-blue-600`}>{row.companyCount}</td>
                      <td className={`${tdClass} font-semibold text-amber-600`}>{row.dineshCount}</td>
                      <td className={`${tdClass} font-semibold text-purple-600`}>{row.vikasCount}</td>
                      <td className={tdClass}>₹{row.totalDaysAmount}</td>
                      <td className={tdClass}>₹{row.totalOTAmount}</td>
                      <td className={tdClass}>₹{row.totalRefreshment}</td>
                      <td className={`${tdClass} font-bold text-green-600 bg-green-50/30`}>₹{row.grossSalary}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground bg-muted/50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className={thClass}>Category</th>
                  <th className={thClass}>Employee Name</th>
                  <th className={thClass}>Designation</th>
                  <th className={thClass}>Basic Salary</th>
                  <th className={thClass}>Total Days</th>
                  <th className={thClass}>Days Amount</th>
                  <th className={thClass}>Total OT (Hrs)</th>
                  <th className={thClass}>OT Amount</th>
                  <th className={thClass}>Refreshment</th>
                  <th className={thClass}>Gross Salary</th>
                </tr>
              </thead>
              {/* Grand Totals at Top */}
              {!isLoading && reportData.length > 0 && (
                <tbody className="bg-muted/30 border-b-2 border-border font-bold">
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-right text-foreground uppercase tracking-wider">
                      Grand Total
                    </td>
                    <td className="px-3 py-4 text-primary">
                      {reportData.reduce((sum, r) => sum + r.totalPresent, 0)}
                    </td>
                    <td className="px-3 py-4 text-foreground">
                      ₹{reportData.reduce((sum, r) => sum + r.totalDaysAmount, 0)}
                    </td>
                    <td className="px-3 py-4 text-primary">
                      {reportData.reduce((sum, r) => sum + r.totalOTHours, 0).toFixed(2)}
                    </td>
                    <td className="px-3 py-4 text-foreground">
                      ₹{reportData.reduce((sum, r) => sum + r.totalOTAmount, 0)}
                    </td>
                    <td className="px-3 py-4 text-foreground">
                      ₹{reportData.reduce((sum, r) => sum + r.totalRefreshment, 0)}
                    </td>
                    <td className="px-3 py-4 text-green-700 bg-green-100/50">
                      <div className="flex items-center">
                        <IndianRupee className="w-4 h-4 mr-1" />
                        {reportData.reduce((sum, r) => sum + r.grossSalary, 0)}
                      </div>
                    </td>
                  </tr>
                </tbody>
              )}
              <tbody className="divide-y divide-border/50">
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                      Calculating employee report...
                    </td>
                  </tr>
                ) : reportData.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      No attendance records found from {fromDate} to {toDate}.
                    </td>
                  </tr>
                ) : (
                  reportData.map((row, index) => (
                    <tr 
                      key={index} 
                      className="hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEmployeeForLedger(row)}
                    >
                      <td className={tdClass}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${row.category === 'COMPANY' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}`}>
                          {row.category === 'COMPANY' ? 'Company' : `Wages ${row.contractorName ? `(${row.contractorName})` : ''}`}
                        </span>
                      </td>
                      <td className={`${tdClass} font-medium text-foreground`}>{row.name}</td>
                      <td className={tdClass}>{row.designation}</td>
                      <td className={tdClass}>₹{row.basicSalary.toLocaleString()}</td>
                      
                      <td className={`${tdClass} font-semibold text-primary`}>{row.totalPresent}</td>
                      <td className={tdClass}>₹{row.totalDaysAmount}</td>
                      
                      <td className={`${tdClass} font-semibold text-primary`}>{row.totalOTHours.toFixed(2)}</td>
                      <td className={tdClass}>₹{row.totalOTAmount}</td>
                      
                      <td className={tdClass}>₹{row.totalRefreshment}</td>
                      
                      <td className={`${tdClass} font-bold text-green-600 bg-green-50/30`}>
                        ₹{row.grossSalary}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Ledger Modal */}
      {selectedEmployeeForLedger && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card w-full max-w-5xl rounded-lg border border-border shadow-lg flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Employee Ledger
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedEmployeeForLedger.name} ({selectedEmployeeForLedger.designation}) - {fromDate} to {toDate}
                </p>
              </div>
              <button 
                onClick={() => setSelectedEmployeeForLedger(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-md hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <table className="w-full text-sm text-left border border-border rounded-lg overflow-hidden">
                <thead className="text-xs text-muted-foreground bg-muted/50">
                  <tr>
                    <th className={thClass}>Date</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Salary Amount</th>
                    <th className={thClass}>OT Hours</th>
                    <th className={thClass}>OT Amount</th>
                    <th className={thClass}>Refreshment</th>
                    <th className={thClass}>Daily Total</th>
                  </tr>
                </thead>
                <tbody>
                  {records
                    .filter(r => r.employeeId === selectedEmployeeForLedger.id)
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map(record => {
                      const dailyTotal = record.perDayAmount + record.otAmount + record.refreshment;
                      return (
                        <tr key={record.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                          <td className={`${tdClass} font-medium`}>
                            {new Date(record.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </td>
                          <td className={tdClass}>
                            <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                              record.present === 1 ? 'bg-green-100 text-green-800' : 
                              record.present === 0.5 ? 'bg-amber-100 text-amber-800' : 
                              'bg-red-100 text-red-800'
                            }`}>
                              {record.present === 1 ? 'Full Day' : record.present === 0.5 ? 'Half Day' : 'Absent'}
                            </span>
                          </td>
                          <td className={tdClass}>₹{record.perDayAmount.toFixed(2)}</td>
                          <td className={tdClass}>{record.otHours}</td>
                          <td className={tdClass}>₹{record.otAmount.toFixed(2)}</td>
                          <td className={tdClass}>₹{record.refreshment.toFixed(2)}</td>
                          <td className={`${tdClass} font-bold text-primary`}>₹{dailyTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  {records.filter(r => r.employeeId === selectedEmployeeForLedger.id).length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-muted-foreground">
                        No detailed records found for this month.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
