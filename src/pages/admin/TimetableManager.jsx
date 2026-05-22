import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import {
  WEEKDAYS,
  DEFAULT_PERIODS,
  MAX_STREAMS,
  slotKey,
  parseSlotKey,
} from '../../lib/timetableDefaults';
import {
  CalendarDays,
  Loader2,
  AlertCircle,
  Save,
  Send,
  Copy,
  X,
  BookOpen,
  User,
  MapPin,
  Grid3X3,
  Search,
} from 'lucide-react';
import SelectField from '../../components/admin/SelectField';

const emptyCell = () => ({ subjectId: '', teacherId: '', room: '' });

const TimetableManager = () => {
  const { user } = useAuth();
  const [schoolId, setSchoolId] = useState(null);
  const [streams, setStreams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeStreamId, setActiveStreamId] = useState(null);
  const [timetableId, setTimetableId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [grid, setGrid] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [editCell, setEditCell] = useState(null);
  const [copyFromId, setCopyFromId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredStreams = useMemo(() => 
    streams.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [streams, searchTerm]
  );

  const activeStream = useMemo(
    () => streams.find((s) => s.id === activeStreamId),
    [streams, activeStreamId]
  );

  const loadReferenceData = useCallback(async () => {
    const { data: profile } = await supabase
      .from('users')
      .select('school_id')
      .eq('id', user.id)
      .single();

    if (!profile?.school_id) throw new Error('School profile not found.');

    setSchoolId(profile.school_id);

    const [classRes, subjectRes, teacherRes] = await Promise.all([
      supabase.from('classes').select('*').eq('school_id', profile.school_id).order('name'),
      supabase.from('subjects').select('*').eq('school_id', profile.school_id).order('name'),
      supabase.from('all_teachers_view').select('*').order('full_name'),
    ]);

    if (classRes.error) throw classRes.error;
    if (subjectRes.error) throw subjectRes.error;
    if (teacherRes.error) throw teacherRes.error;

    const classList = (classRes.data || []).slice(0, MAX_STREAMS);
    setStreams(classList);
    setSubjects(subjectRes.data || []);
    setTeachers(teacherRes.data || []);

    if (classList.length > 0) {
      setActiveStreamId((prev) => prev ?? classList[0].id);
    }
  }, [user.id]);

  const loadStreamTimetable = useCallback(
    async (classId) => {
      if (!classId || !schoolId) return;

      setLoading(true);
      setError(null);
      setGrid({});
      setTimetableId(null);
      setStatus('draft');

      try {
        let { data: timetable, error: ttError } = await supabase
          .from('timetables')
          .select('id, status')
          .eq('school_id', schoolId)
          .eq('class_id', classId)
          .maybeSingle();

        if (ttError) {
          if (ttError.message?.includes('does not exist')) {
            setError(
              'Timetable tables are not set up yet. Run supabase/migrations/001_timetables.sql in your Supabase SQL Editor.'
            );
            return;
          }
          throw ttError;
        }

        if (!timetable) {
          setStatus('draft');
          return;
        }

        setTimetableId(timetable.id);
        setStatus(timetable.status || 'draft');

        const { data: slots, error: slotError } = await supabase
          .from('timetable_slots')
          .select('*')
          .eq('timetable_id', timetable.id);

        if (slotError) throw slotError;

        const nextGrid = {};
        (slots || []).forEach((slot) => {
          nextGrid[slotKey(slot.day_of_week, slot.period_number)] = {
            subjectId: slot.subject_id || '',
            teacherId: slot.teacher_id || '',
            room: slot.room || '',
          };
        });
        setGrid(nextGrid);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [schoolId]
  );

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await loadReferenceData();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadReferenceData]);

  useEffect(() => {
    if (activeStreamId && schoolId) {
      loadStreamTimetable(activeStreamId);
    }
  }, [activeStreamId, schoolId, loadStreamTimetable]);

  const ensureTimetable = async () => {
    if (timetableId) return timetableId;

    const { data, error: insError } = await supabase
      .from('timetables')
      .insert([{ school_id: schoolId, class_id: activeStreamId, status: 'draft' }])
      .select('id')
      .single();

    if (insError) throw insError;
    setTimetableId(data.id);
    return data.id;
  };

  const handleSaveDraft = async () => {
    if (!activeStreamId) return;
    setSaving(true);
    setError(null);

    try {
      const ttId = await ensureTimetable();

      await supabase
        .from('timetables')
        .update({ status: 'draft', updated_at: new Date().toISOString() })
        .eq('id', ttId);

      await persistSlots(ttId);
      setStatus('draft');
      await loadStreamTimetable(activeStreamId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm(`Publish timetable for ${activeStream?.name}? Teachers and students can rely on this schedule.`)) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ttId = await ensureTimetable();
      await persistSlots(ttId);
      const { error: pubError } = await supabase
        .from('timetables')
        .update({ status: 'published', updated_at: new Date().toISOString() })
        .eq('id', ttId);
      if (pubError) throw pubError;
      setStatus('published');
      await loadStreamTimetable(activeStreamId);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const persistSlots = async (ttId) => {
    const { data: existing } = await supabase
      .from('timetable_slots')
      .select('id, day_of_week, period_number')
      .eq('timetable_id', ttId);

    const filledKeys = new Set();
    const toUpsert = [];

    Object.entries(grid).forEach(([key, cell]) => {
      if (!cell.subjectId && !cell.teacherId && !cell.room?.trim()) return;
      const { day, period } = parseSlotKey(key);
      const periodMeta = DEFAULT_PERIODS.find((p) => p.period === period);
      if (!periodMeta) return;

      filledKeys.add(key);
      toUpsert.push({
        timetable_id: ttId,
        day_of_week: day,
        period_number: period,
        start_time: periodMeta.start,
        end_time: periodMeta.end,
        subject_id: cell.subjectId || null,
        teacher_id: cell.teacherId || null,
        room: cell.room?.trim() || null,
      });
    });

    if (toUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('timetable_slots')
        .upsert(toUpsert, { onConflict: 'timetable_id,day_of_week,period_number' });
      if (upsertError) throw upsertError;
    }

    const toDelete = (existing || [])
      .filter((r) => !filledKeys.has(slotKey(r.day_of_week, r.period_number)))
      .map((r) => r.id);

    if (toDelete.length > 0) {
      await supabase.from('timetable_slots').delete().in('id', toDelete);
    }
  };

  const handleCopyFromStream = async () => {
    if (!copyFromId || copyFromId === activeStreamId) return;

    setSaving(true);
    setError(null);

    try {
      const { data: sourceTt } = await supabase
        .from('timetables')
        .select('id')
        .eq('school_id', schoolId)
        .eq('class_id', copyFromId)
        .maybeSingle();

      if (!sourceTt?.id) {
        alert('Selected stream has no timetable to copy yet.');
        return;
      }

      const { data: sourceSlots } = await supabase
        .from('timetable_slots')
        .select('day_of_week, period_number, subject_id, teacher_id, room')
        .eq('timetable_id', sourceTt.id);

      const nextGrid = {};
      (sourceSlots || []).forEach((slot) => {
        nextGrid[slotKey(slot.day_of_week, slot.period_number)] = {
          subjectId: slot.subject_id || '',
          teacherId: slot.teacher_id || '',
          room: slot.room || '',
        };
      });
      setGrid(nextGrid);
      setCopyFromId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openCellEditor = (day, period) => {
    const key = slotKey(day, period);
    setEditCell({
      key,
      day,
      period,
      ...emptyCell(),
      ...grid[key],
    });
  };

  const applyCellEdit = () => {
    if (!editCell) return;
    const { key, subjectId, teacherId, room } = editCell;
    setGrid((prev) => {
      const next = { ...prev };
      if (!subjectId && !teacherId && !room?.trim()) {
        delete next[key];
      } else {
        next[key] = { subjectId, teacherId, room: room || '' };
      }
      return next;
    });
    setEditCell(null);
  };

  const getSubjectName = (id) => subjects.find((s) => s.id === id)?.name;
  const getTeacherName = (id) => {
    if (!id) return null;
    const t = teachers.find((x) => x.registered_id === id);
    return t?.full_name;
  };

  const teacherOptions = (
    <>
      <option value="">— Select teacher —</option>
      {teachers.map((t) =>
        t.registered_id ? (
          <option key={t.email} value={t.registered_id}>
            {t.full_name}
          </option>
        ) : (
          <option key={t.email} value="" disabled>
            {t.full_name} (pending registration)
          </option>
        )
      )}
    </>
  );

  const subjectOptions = (
    <>
      <option value="">— Select subject —</option>
      {subjects.length === 0 ? (
        <option value="" disabled>
          No subjects — add them under Subjects
        </option>
      ) : (
        subjects.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))
      )}
    </>
  );

  if (loading && streams.length === 0) {
    return (
      <div className="h-[50vh] flex flex-col items-center justify-center text-white">
        <Loader2 className="animate-spin text-aurora-cyan mb-4" size={40} />
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Loading streams...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 text-white">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tighter uppercase">
            Timetable Studio
          </h2>
          <p className="text-slate-400 mt-1 font-black text-[10px] sm:text-xs uppercase tracking-[0.2em]">
            Draft weekly schedules for up to {MAX_STREAMS} streams (classes).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <input
              type="text"
              placeholder="Search streams..."
              className="bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 transition-all w-full sm:w-64 lg:w-80 shadow-xl"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary-400 transition-colors" size={18} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border ${
                status === 'published'
                  ? 'bg-aurora-emerald/10 text-aurora-emerald border-aurora-emerald/20'
                  : 'bg-aurora-amber/10 text-aurora-amber border-aurora-amber/20'
              }`}
            >
              {status === 'published' ? 'Published' : 'Draft'}
            </span>
            <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-2xl border border-white/10">
              <Grid3X3 className="text-aurora-violet" size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {streams.length} / {MAX_STREAMS} streams
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-aurora-rose/10 border border-aurora-rose/20 text-aurora-rose px-6 py-4 rounded-2xl flex items-start gap-3">
          <AlertCircle size={20} className="shrink-0 mt-0.5" />
          <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">{error}</p>
        </div>
      )}

      {streams.length === 0 ? (
        <div className="glass-card p-16 text-center border-dashed">
          <CalendarDays className="mx-auto text-slate-600 mb-4" size={48} />
          <p className="text-slate-500 font-black uppercase tracking-widest text-xs">
            Add classes first — each class is a stream for timetabling.
          </p>
        </div>
      ) : (
        <>
          {/* Stream tabs */}
          <div className="glass-card p-4 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 min-w-max">
              {filteredStreams.length === 0 ? (
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 py-2">
                  No streams matching "{searchTerm}"
                </p>
              ) : (
                filteredStreams.map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => setActiveStreamId(stream.id)}
                    className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      activeStreamId === stream.id
                        ? 'bg-gradient-to-r from-aurora-cyan to-aurora-violet text-white shadow-neon-cyan'
                        : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {stream.name}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Copy from another stream */}
          <div className="glass-card p-6 flex flex-col sm:flex-row gap-4 items-stretch sm:items-end">
            <SelectField
              className="flex-1"
              label="Copy layout from another stream"
              value={copyFromId}
              onChange={(e) => setCopyFromId(e.target.value)}
            >
              <option value="">Select source stream</option>
              {streams
                .filter((s) => s.id !== activeStreamId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </SelectField>
            <button
              type="button"
              disabled={!copyFromId || saving}
              onClick={handleCopyFromStream}
              className="btn-primary px-8 py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Copy size={16} /> Copy slots
            </button>
          </div>

          {/* Weekly grid */}
          <div className="glass-card p-4 lg:p-8 overflow-x-auto">
            {loading ? (
              <div className="py-20 text-center">
                <Loader2 className="animate-spin text-aurora-cyan mx-auto" size={32} />
              </div>
            ) : (
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr>
                    <th className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest w-24">
                      Period
                    </th>
                    {WEEKDAYS.map((day) => (
                      <th
                        key={day}
                        className="p-3 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center"
                      >
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEFAULT_PERIODS.map((period) => (
                    <tr key={period.period} className="border-t border-white/5">
                      <td className="p-2 align-top">
                        <div className="text-[10px] font-black text-aurora-cyan">P{period.period}</div>
                        <div className="text-[9px] text-slate-500 font-bold">
                          {period.start}–{period.end}
                        </div>
                      </td>
                      {WEEKDAYS.map((_, dayIndex) => {
                        const key = slotKey(dayIndex, period.period);
                        const cell = grid[key];
                        const hasContent = cell?.subjectId || cell?.teacherId || cell?.room;
                        return (
                          <td key={key} className="p-1">
                            <button
                              type="button"
                              onClick={() => openCellEditor(dayIndex, period.period)}
                              className={`w-full min-h-[72px] rounded-xl p-2 text-left transition-all border ${
                                hasContent
                                  ? 'bg-aurora-violet/10 border-aurora-violet/30 hover:bg-aurora-violet/20'
                                  : 'bg-white/5 border-white/10 hover:bg-white/10 border-dashed'
                              }`}
                            >
                              {hasContent ? (
                                <>
                                  <p className="text-[10px] font-black text-white truncate">
                                    {getSubjectName(cell.subjectId) || '—'}
                                  </p>
                                  <p className="text-[9px] text-slate-400 truncate mt-0.5">
                                    {getTeacherName(cell.teacherId) || 'No teacher'}
                                  </p>
                                  {cell.room && (
                                    <p className="text-[8px] text-aurora-cyan mt-1 truncate">{cell.room}</p>
                                  )}
                                </>
                              ) : (
                                <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                                  + Add
                                </span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              disabled={saving}
              onClick={handleSaveDraft}
              className="btn-primary flex-1 py-5 text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-2 shadow-neon-cyan"
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={18} /> Save draft</>}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handlePublish}
              className="flex-1 py-5 rounded-2xl bg-aurora-emerald/20 border border-aurora-emerald/30 text-aurora-emerald font-black text-[11px] uppercase tracking-[0.3em] hover:bg-aurora-emerald hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Send size={18} /> Publish {activeStream?.name}
            </button>
          </div>
        </>
      )}

      {/* Cell editor modal */}
      {editCell && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-aurora-navy/90 backdrop-blur-md" onClick={() => setEditCell(null)} />
          <div className="relative glass-card w-full max-w-md p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-white uppercase tracking-widest text-sm">
                {WEEKDAYS[editCell.day]} · Period {editCell.period}
              </h3>
              <button
                type="button"
                onClick={() => setEditCell(null)}
                className="p-2 text-slate-500 hover:text-white rounded-xl hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <SelectField
                label="Subject"
                icon={BookOpen}
                value={editCell.subjectId}
                onChange={(e) => setEditCell({ ...editCell, subjectId: e.target.value })}
              >
                {subjectOptions}
              </SelectField>

              <SelectField
                label="Teacher"
                icon={User}
                value={editCell.teacherId}
                onChange={(e) => setEditCell({ ...editCell, teacherId: e.target.value })}
              >
                {teacherOptions}
              </SelectField>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Room</label>
                <div className="relative">
                  <input
                    type="text"
                    className="input-field pl-12 w-full"
                    placeholder="e.g. Lab 2"
                    value={editCell.room}
                    onChange={(e) => setEditCell({ ...editCell, room: e.target.value })}
                  />
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-aurora-amber" size={18} />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  const key = editCell.key;
                  setGrid((prev) => {
                    const next = { ...prev };
                    delete next[key];
                    return next;
                  });
                  setEditCell(null);
                }}
                className="flex-1 py-4 rounded-2xl border border-aurora-rose/30 text-aurora-rose text-[10px] font-black uppercase tracking-widest hover:bg-aurora-rose/10"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={applyCellEdit}
                className="btn-primary flex-1 py-4 text-[10px] font-black uppercase tracking-widest"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimetableManager;
