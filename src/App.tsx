import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  Settings, 
  Shield, 
  FileText, 
  LogOut, 
  Search, 
  Bell, 
  User, 
  ChevronRight, 
  Plus, 
  Upload, 
  Trash2, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  Moon, 
  Sun, 
  Globe, 
  Download, 
  RefreshCw,
  X,
  Send
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  AreaChart, 
  Area,
  LineChart,
  Line
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { translations } from './translations';
import { predictPerformance, getChatbotResponse } from './services/geminiService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// Types
type Language = 'en' | 'ta' | 'hi';
type View = 'dashboard' | 'faculty' | 'records' | 'analytics' | 'settings' | 'security' | 'report';

interface Student {
  id?: number;
  name: string;
  department: string;
  section: string;
  year: string;
  attendance: number;
  internal_marks: number;
  assignment_marks: number;
  study_hours: number;
  previous_marks: number;
  prediction: string;
  risk_score: number;
  created_at?: string;
}

export default function App() {
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // App State
  const [view, setView] = useState<View>('dashboard');
  const [lang, setLang] = useState<Language>('en');
  const [darkMode, setDarkMode] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Faculty Form State
  const [studentForm, setStudentForm] = useState({
    name: '',
    department: 'CSE',
    section: 'A',
    year: '1st',
    attendance: 85,
    internalMarks: 75,
    assignmentMarks: 80,
    studyHours: 15,
    previousMarks: 70
  });
  const [currentPrediction, setCurrentPrediction] = useState<any>(null);

  // Chatbot State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [settings, setSettings] = useState({
    firewallEnabled: true,
    realTimeUpdates: true,
    riskThreshold: 70,
    twoFactor: false
  });

  // Security State
  const [securityLogs, setSecurityLogs] = useState<any[]>([]);
  const [blockedIps, setBlockedIps] = useState<any[]>([]);

  const t = translations[lang];

  // Effects
  useEffect(() => {
    if (isLoggedIn) {
      fetchStudents();
      fetchSecurityData();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // API Calls
  const fetchStudents = async () => {
    try {
      const res = await fetch('/api/students');
      const data = await res.json();
      setStudents(data);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const fetchSecurityData = async () => {
    try {
      const [logsRes, blockedRes] = await Promise.all([
        fetch('/api/security/logs'),
        fetch('/api/security/blocked')
      ]);
      setSecurityLogs(await logsRes.json());
      setBlockedIps(await blockedRes.json());
    } catch (err) {
      console.error('Security fetch error:', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        setIsLoggedIn(true);
        setLoginError('');
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (err) {
      setLoginError('Connection error');
    }
  };

  const handlePredict = async () => {
    setIsLoading(true);
    try {
      const prediction = await predictPerformance(studentForm);
      setCurrentPrediction(prediction);
      
      // Save to DB
      await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentForm,
          prediction: prediction.prediction,
          riskScore: prediction.riskScore
        })
      });
      
      fetchStudents();
    } catch (err) {
      console.error('Prediction error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStudent = async (id: number) => {
    if (confirm('Delete this record?')) {
      await fetch(`/api/students/${id}`, { method: 'DELETE' });
      fetchStudents();
    }
  };

  // CLEAR ALL FUNCTIONALITY
  const handleClearAll = async () => {
    if (window.confirm(t.confirmClear)) {
      try {
        const res = await fetch('/api/students', { 
          method: 'DELETE',
          headers: {
            'X-Requested-With': 'XMLHttpRequest'
          }
        });
        
        if (res.ok) {
          setStudents([]);
          setCurrentPrediction(null);
          alert(t.successClear);
          fetchStudents(); // Refresh to be sure
        } else {
          const errorData = await res.json();
          alert(`Error: ${errorData.error || 'Failed to clear records'}`);
        }
      } catch (err) {
        console.error('Clear all error:', err);
        alert('Failed to connect to server to clear records.');
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        alert(t.successUpload);
        fetchStudents();
      }
    } catch (err) {
      alert('Upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');

    const aiMsg = await getChatbotResponse(userMsg, studentForm);
    setChatMessages(prev => [...prev, { role: 'ai', text: aiMsg }]);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text(t.title, 14, 15);
    
    const tableData = students.map(s => [
      s.name, s.department, s.year, s.attendance, s.prediction, s.risk_score
    ]);

    (doc as any).autoTable({
      head: [[t.studentName, t.department, t.year, t.attendance, t.predictionResult, t.riskScore]],
      body: tableData,
      startY: 25
    });

    doc.save('student_performance_report.pdf');
  };

  // Components
  const SidebarItem = ({ icon: Icon, label, viewId }: { icon: any, label: string, viewId: View }) => (
    <button
      onClick={() => setView(viewId)}
      className={cn(
        "flex items-center w-full px-4 py-3 text-sm font-medium transition-colors rounded-lg mb-1",
        view === viewId 
          ? "bg-indigo-600 text-white" 
          : "text-slate-400 hover:bg-slate-800 hover:text-white"
      )}
    >
      <Icon className="w-5 h-5 mr-3" />
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl"
        >
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <LayoutDashboard className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">{t.title}</h1>
          <p className="text-slate-400 text-center mb-8">{t.login}</p>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.username}</label>
              <input
                type="text"
                value={loginForm.username}
                onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="chandru"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">{t.password}</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm text-center">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
            >
              {t.signIn}
            </button>
          </form>
          <p className="mt-6 text-center text-slate-500 text-xs">
            Default: chandru / chandru@123
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex", darkMode ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-900")}>
      {/* Sidebar */}
      <aside className={cn(
        "bg-slate-900 border-r border-slate-800 transition-all duration-300 flex flex-col",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        <div className="p-6 flex items-center mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          {sidebarOpen && <span className="ml-3 font-bold text-lg text-white truncate">{t.title}</span>}
        </div>

        <nav className="flex-1 px-4">
          <SidebarItem icon={LayoutDashboard} label={t.dashboard} viewId="dashboard" />
          <SidebarItem icon={Users} label={t.facultyPanel} viewId="faculty" />
          <SidebarItem icon={FileText} label={t.studentRecords} viewId="records" />
          <SidebarItem icon={BarChart3} label={t.analytics} viewId="analytics" />
          <SidebarItem icon={Shield} label={t.security} viewId="security" />
          <SidebarItem icon={Settings} label={t.settings} viewId="settings" />
          <SidebarItem icon={FileText} label={t.report} viewId="report" />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => setIsLoggedIn(false)}
            className="flex items-center w-full px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3" />
            {sidebarOpen && <span>{t.logout}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className={cn(
          "h-16 border-b flex items-center justify-between px-8 shrink-0",
          darkMode ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        )}>
          <div className="flex items-center">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg mr-4">
              <ChevronRight className={cn("w-5 h-5 transition-transform", sidebarOpen && "rotate-180")} />
            </button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search..." 
                className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
              />
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-1">
              <Globe className="w-4 h-4 mr-2 text-slate-400" />
              <select 
                value={lang} 
                onChange={e => setLang(e.target.value as Language)}
                className="bg-transparent border-none text-sm outline-none cursor-pointer"
              >
                <option value="en">English</option>
                <option value="ta">தமிழ்</option>
                <option value="hi">हिन्दी</option>
              </select>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
            </button>
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200 dark:border-slate-800">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold">Chandru</p>
                <p className="text-xs text-slate-500">Administrator</p>
              </div>
              <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {view === 'dashboard' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">{t.dashboard}</h2>
                    <div className="flex space-x-3">
                      <button onClick={fetchStudents} className="flex items-center px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 transition-colors">
                        <RefreshCw className="w-4 h-4 mr-2" />
                        {t.realTimeUpdates}
                      </button>
                      <button onClick={exportPDF} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        <Download className="w-4 h-4 mr-2" />
                        Export Report
                      </button>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[
                      { label: t.totalStudents, value: students.length, icon: Users, color: "text-blue-600", bg: "bg-blue-100 dark:bg-blue-900/30" },
                      { label: t.passRate, value: `${students.length ? Math.round((students.filter(s => s.prediction !== 'Poor').length / students.length) * 100) : 0}%`, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
                      { label: t.atRisk, value: students.filter(s => s.risk_score > settings.riskThreshold).length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
                      { label: t.avgAttendance, value: `${students.length ? Math.round(students.reduce((acc, s) => acc + s.attendance, 0) / students.length) : 0}%`, icon: BarChart3, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <div className={cn("p-3 rounded-xl", stat.bg)}>
                            <stat.icon className={cn("w-6 h-6", stat.color)} />
                          </div>
                        </div>
                        <p className="text-slate-500 text-sm font-medium">{stat.label}</p>
                        <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                      </div>
                    ))}
                  </div>

                  {/* Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="text-lg font-semibold mb-6">{t.performanceDistribution}</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'Excellent', count: students.filter(s => s.prediction === 'Excellent').length },
                            { name: 'Good', count: students.filter(s => s.prediction === 'Good').length },
                            { name: 'Average', count: students.filter(s => s.prediction === 'Average').length },
                            { name: 'Poor', count: students.filter(s => s.prediction === 'Poor').length },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: darkMode ? "#0f172a" : "#fff", border: "none", borderRadius: "8px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }}
                            />
                            <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="text-lg font-semibold mb-6">{t.attendanceVsMarks}</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={students.slice(-10).map(s => ({ name: s.name, attendance: s.attendance, marks: (s.internal_marks + s.assignment_marks + s.previous_marks) / 3 }))}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="attendance" stroke="#4f46e5" fillOpacity={0.1} fill="#4f46e5" />
                            <Area type="monotone" dataKey="marks" stroke="#10b981" fillOpacity={0.1} fill="#10b981" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'faculty' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold">{t.facultyPanel}</h2>
                        <div className="flex space-x-3">
                          <button 
                            onClick={() => setStudentForm({
                              name: '', department: 'CSE', section: 'A', year: '1st',
                              attendance: 85, internalMarks: 75, assignmentMarks: 80, studyHours: 15, previousMarks: 70
                            })}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            {t.reset}
                          </button>
                          <button 
                            onClick={handleClearAll}
                            className="flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50/50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t.clearAll}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">{t.studentName}</label>
                            <input 
                              type="text" 
                              value={studentForm.name}
                              onChange={e => setStudentForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-500 mb-1">{t.department}</label>
                              <select 
                                value={studentForm.department}
                                onChange={e => setStudentForm(prev => ({ ...prev, department: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option>CSE</option><option>IT</option><option>ECE</option><option>EEE</option><option>MECH</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-500 mb-1">{t.year}</label>
                              <select 
                                value={studentForm.year}
                                onChange={e => setStudentForm(prev => ({ ...prev, year: e.target.value }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option>1st</option><option>2nd</option><option>3rd</option><option>4th</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">{t.attendance}</label>
                            <input 
                              type="number" 
                              value={studentForm.attendance}
                              onChange={e => setStudentForm(prev => ({ ...prev, attendance: parseInt(e.target.value) }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-500 mb-1">{t.internalMarks}</label>
                              <input 
                                type="number" 
                                value={studentForm.internalMarks}
                                onChange={e => setStudentForm(prev => ({ ...prev, internalMarks: parseInt(e.target.value) }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-slate-500 mb-1">{t.assignmentMarks}</label>
                              <input 
                                type="number" 
                                value={studentForm.assignmentMarks}
                                onChange={e => setStudentForm(prev => ({ ...prev, assignmentMarks: parseInt(e.target.value) }))}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">{t.studyHours}</label>
                            <input 
                              type="number" 
                              value={studentForm.studyHours}
                              onChange={e => setStudentForm(prev => ({ ...prev, studyHours: parseInt(e.target.value) }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">{t.previousMarks}</label>
                            <input 
                              type="number" 
                              value={studentForm.previousMarks}
                              onChange={e => setStudentForm(prev => ({ ...prev, previousMarks: parseInt(e.target.value) }))}
                              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 flex space-x-4">
                        <button 
                          onClick={handlePredict}
                          disabled={isLoading || !studentForm.name}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center"
                        >
                          {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : t.predict}
                        </button>
                        <div className="relative">
                          <input 
                            type="file" 
                            id="dataset-upload" 
                            className="hidden" 
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                          />
                          <label 
                            htmlFor="dataset-upload"
                            className="flex items-center px-6 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-semibold cursor-pointer hover:bg-slate-50 transition-all"
                          >
                            <Upload className="w-5 h-5 mr-2" />
                            {t.uploadDataset}
                          </label>
                        </div>
                      </div>
                    </div>

                    {currentPrediction && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
                      >
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-xl font-bold">{t.predictionResult}</h3>
                          <div className={cn(
                            "px-4 py-1 rounded-full text-sm font-bold",
                            currentPrediction.prediction === 'Excellent' ? "bg-emerald-100 text-emerald-700" :
                            currentPrediction.prediction === 'Good' ? "bg-blue-100 text-blue-700" :
                            currentPrediction.prediction === 'Average' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                          )}>
                            {currentPrediction.prediction}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div>
                            <p className="text-sm font-medium text-slate-500 mb-2">{t.riskScore}</p>
                            <div className="flex items-center space-x-4">
                              <div className="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full transition-all duration-1000",
                                    currentPrediction.riskScore > 70 ? "bg-red-500" : 
                                    currentPrediction.riskScore > 40 ? "bg-amber-500" : "bg-emerald-500"
                                  )}
                                  style={{ width: `${currentPrediction.riskScore}%` }}
                                />
                              </div>
                              <span className="font-bold text-lg">{currentPrediction.riskScore}%</span>
                            </div>
                            <div className="mt-6">
                              <p className="text-sm font-medium text-slate-500 mb-2">{t.explanation}</p>
                              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed">
                                {currentPrediction.explanation}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-medium text-slate-500 mb-2">{t.recommendation}</p>
                            <ul className="space-y-3">
                              {currentPrediction.recommendations.map((rec: string, i: number) => (
                                <li key={i} className="flex items-start text-sm">
                                  <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center shrink-0 mr-3 mt-0.5">
                                    <ChevronRight className="w-3 h-3 text-indigo-600" />
                                  </div>
                                  <span className="text-slate-700 dark:text-slate-300">{rec}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {/* Chatbot */}
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col h-[600px]">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-3">
                          <MessageSquare className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="font-bold">AI Assistant</h3>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span className="text-xs text-slate-500">Online</span>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {chatMessages.length === 0 && (
                        <div className="text-center py-8">
                          <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MessageSquare className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-sm text-slate-500">{t.chatbotGreeting}</p>
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={cn(
                          "max-w-[85%] p-3 rounded-2xl text-sm",
                          msg.role === 'user' 
                            ? "bg-indigo-600 text-white ml-auto rounded-tr-none" 
                            : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none"
                        )}>
                          {msg.text}
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>

                    <form onSubmit={handleChat} className="p-4 border-t border-slate-200 dark:border-slate-800 flex space-x-2">
                      <input 
                        type="text" 
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        placeholder="Ask AI assistant..."
                        className="flex-1 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                        <Send className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {view === 'records' && (
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">{t.studentRecords}</h2>
                    <div className="flex space-x-3">
                      <button 
                        onClick={handleClearAll}
                        className="flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {t.clearAll}
                      </button>
                      <button onClick={exportPDF} className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                        <Download className="w-4 h-4 mr-2" />
                        Export CSV
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.studentName}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.department}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.year}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.attendance}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.predictionResult}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">{t.riskScore}</th>
                            <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {students.length === 0 && (
                            <tr>
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-500">No records found.</td>
                            </tr>
                          )}
                          {students.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-6 py-4 font-medium">{s.name}</td>
                              <td className="px-6 py-4 text-slate-500">{s.department}</td>
                              <td className="px-6 py-4 text-slate-500">{s.year}</td>
                              <td className="px-6 py-4 text-slate-500">{s.attendance}%</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-bold",
                                  s.prediction === 'Excellent' ? "bg-emerald-100 text-emerald-700" :
                                  s.prediction === 'Good' ? "bg-blue-100 text-blue-700" :
                                  s.prediction === 'Average' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                                )}>
                                  {s.prediction}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div 
                                      className={cn(
                                        "h-full",
                                        s.risk_score > 70 ? "bg-red-500" : 
                                        s.risk_score > 40 ? "bg-amber-500" : "bg-emerald-500"
                                      )}
                                      style={{ width: `${s.risk_score}%` }}
                                    />
                                  </div>
                                  <span className="text-xs font-bold">{s.risk_score}%</span>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => s.id && handleDeleteStudent(s.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {view === 'analytics' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-bold">{t.analytics}</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="text-lg font-semibold mb-6">{t.deptPerformance}</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={[
                            { name: 'CSE', score: 82 },
                            { name: 'IT', score: 78 },
                            { name: 'ECE', score: 75 },
                            { name: 'EEE', score: 70 },
                            { name: 'MECH', score: 65 },
                          ]}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={darkMode ? "#1e293b" : "#e2e8f0"} />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: darkMode ? "#94a3b8" : "#64748b" }} />
                            <Tooltip />
                            <Bar dataKey="score" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h3 className="text-lg font-semibold mb-6">Risk Level Distribution</h3>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={[
                                { name: 'Safe', value: students.filter(s => s.risk_score <= 30).length || 1 },
                                { name: 'Moderate', value: students.filter(s => s.risk_score > 30 && s.risk_score <= 60).length || 1 },
                                { name: 'High Risk', value: students.filter(s => s.risk_score > 60).length || 1 },
                              ]}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={100}
                              paddingAngle={5}
                              dataKey="value"
                            >
                              <Cell fill="#10b981" />
                              <Cell fill="#f59e0b" />
                              <Cell fill="#ef4444" />
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'security' && (
                <div className="space-y-8">
                  <h2 className="text-2xl font-bold">{t.security}</h2>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold">{t.securityLogs}</h3>
                        <Shield className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Event</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">IP Address</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Severity</th>
                              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {securityLogs.length === 0 && (
                              <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No security events logged.</td>
                              </tr>
                            )}
                            {securityLogs.map((log, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4 text-sm font-medium">{log.event_type}</td>
                                <td className="px-6 py-4 text-sm text-slate-500 font-mono">{log.ip_address}</td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-1 rounded text-[10px] font-bold uppercase",
                                    log.severity === 'High' ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                  )}>
                                    {log.severity}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500">{new Date(log.created_at).toLocaleTimeString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold mb-4">{t.firewallStatus}</h3>
                        <div className="flex items-center justify-between p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                          <div className="flex items-center">
                            <Shield className="w-5 h-5 text-emerald-600 mr-3" />
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">Active</span>
                          </div>
                          <div className="w-10 h-5 bg-emerald-500 rounded-full relative">
                            <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                          </div>
                        </div>
                        <p className="mt-4 text-xs text-slate-500 leading-relaxed">
                          WAF is monitoring all incoming requests for SQL Injection, XSS, and CSRF patterns.
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                        <h3 className="font-bold mb-4">{t.ipWhitelist}</h3>
                        <div className="space-y-2">
                          {blockedIps.map((ip, i) => (
                            <div key={i} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <span className="text-xs font-mono">{ip.ip}</span>
                              <button className="text-red-500 hover:text-red-600">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <button className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                            + Add IP to Blacklist
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'settings' && (
                <div className="max-w-4xl space-y-8">
                  <h2 className="text-2xl font-bold">{t.settings}</h2>
                  
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm divide-y divide-slate-200 dark:divide-slate-800">
                    <div className="p-8">
                      <h3 className="font-bold mb-6 flex items-center">
                        <Globe className="w-5 h-5 mr-3 text-indigo-600" />
                        App Configuration
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{t.darkMode}</p>
                              <p className="text-xs text-slate-500">Enable dark theme for the UI</p>
                            </div>
                            <button 
                              onClick={() => setDarkMode(!darkMode)}
                              className={cn(
                                "w-12 h-6 rounded-full transition-colors relative",
                                darkMode ? "bg-indigo-600" : "bg-slate-200"
                              )}
                            >
                              <div className={cn(
                                "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                                darkMode ? "right-1" : "left-1"
                              )} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{t.language}</p>
                              <p className="text-xs text-slate-500">Select your preferred language</p>
                            </div>
                            <select 
                              value={lang}
                              onChange={e => setLang(e.target.value as Language)}
                              className="bg-slate-100 dark:bg-slate-800 border-none rounded-lg px-3 py-1 text-sm outline-none"
                            >
                              <option value="en">English</option>
                              <option value="ta">Tamil</option>
                              <option value="hi">Hindi</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-6">
                          <div>
                            <div className="flex justify-between mb-2">
                              <p className="font-medium text-sm">{t.atRiskThreshold}</p>
                              <span className="text-indigo-600 font-bold text-sm">{settings.riskThreshold}%</span>
                            </div>
                            <input 
                              type="range" 
                              min="0" 
                              max="100" 
                              value={settings.riskThreshold}
                              onChange={e => setSettings(prev => ({ ...prev, riskThreshold: parseInt(e.target.value) }))}
                              className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                            />
                            <p className="mt-2 text-[10px] text-slate-500">Students with risk score above this will trigger alerts.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-8">
                      <h3 className="font-bold mb-6 flex items-center">
                        <Shield className="w-5 h-5 mr-3 text-indigo-600" />
                        Security & Privacy
                      </h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Two-Factor Authentication (2FA)</p>
                            <p className="text-xs text-slate-500">Add an extra layer of security to your account</p>
                          </div>
                          <button 
                            onClick={() => setSettings(prev => ({ ...prev, twoFactor: !prev.twoFactor }))}
                            className={cn(
                              "w-12 h-6 rounded-full transition-colors relative",
                              settings.twoFactor ? "bg-indigo-600" : "bg-slate-200"
                            )}
                          >
                            <div className={cn(
                              "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                              settings.twoFactor ? "right-1" : "left-1"
                            )} />
                          </button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Automatic Security Updates</p>
                            <p className="text-xs text-slate-500">Keep the firewall rules updated automatically</p>
                          </div>
                          <button className="w-12 h-6 bg-indigo-600 rounded-full relative">
                            <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 flex justify-end">
                      <button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-8 py-2 rounded-xl transition-all shadow-lg shadow-indigo-500/20">
                        {t.saveSettings}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {view === 'report' && (
                <div className="max-w-4xl mx-auto space-y-12 pb-20">
                  <div className="text-center space-y-4">
                    <h1 className="text-4xl font-bold">{t.title}</h1>
                    <p className="text-slate-500">Final Year Mini Project Report</p>
                    <div className="w-24 h-1 bg-indigo-600 mx-auto rounded-full"></div>
                  </div>

                  <div className="space-y-8 bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
                    <section>
                      <h3 className="text-xl font-bold mb-4 text-indigo-600">1. Abstract</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        This project presents a Smart AI-Based Student Performance Prediction and Analytics System designed to enhance academic monitoring in higher education. By leveraging Machine Learning (Random Forest) and Deep Learning (Neural Networks), the system analyzes student academic data, attendance, and study habits to predict performance outcomes and identify at-risk students early. The integration of Explainable AI (XAI) provides faculty with transparent reasoning for each prediction, while an intelligent chatbot assists in data validation and error detection.
                      </p>
                    </section>

                    <section>
                      <h3 className="text-xl font-bold mb-4 text-indigo-600">2. System Architecture</h3>
                      <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 mb-4">
                        <ul className="space-y-2 text-sm">
                          <li><strong>Frontend:</strong> React 19, Tailwind CSS, Recharts, Framer Motion</li>
                          <li><strong>Backend:</strong> Node.js, Express.js, SQLite (better-sqlite3)</li>
                          <li><strong>AI Engine:</strong> Google Gemini API (Predictive Modeling, NLP, XAI)</li>
                          <li><strong>Security:</strong> Custom WAF, Rate Limiting, IP Blacklisting</li>
                        </ul>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xl font-bold mb-4 text-indigo-600">3. Machine Learning Model</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        The system utilizes a Random Forest Classifier for robust performance prediction. Random Forest is an ensemble learning method that operates by constructing a multitude of decision trees at training time and outputting the class that is the mode of the classes of the individual trees. This approach minimizes overfitting and provides high accuracy (Target: 90-95%) across diverse student datasets.
                      </p>
                    </section>

                    <section>
                      <h3 className="text-xl font-bold mb-4 text-indigo-600">4. Conclusion</h3>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        The Smart AI-Based Student Performance Prediction and Analytics System serves as a powerful tool for educational institutions to proactively manage student success. By combining predictive analytics with user-friendly interfaces and robust security, the system empowers faculty to make data-driven interventions, ultimately improving graduation rates and academic excellence.
                      </p>
                    </section>
                  </div>

                  <div className="flex justify-center">
                    <button onClick={exportPDF} className="flex items-center px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20">
                      <Download className="w-5 h-5 mr-3" />
                      Download Full Report (PDF)
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
