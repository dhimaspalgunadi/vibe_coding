'use client';

import { useEffect, useRef, useState } from 'react';
import { TEAM_MEMBERS } from '../data/team';
import { STATUS_OPTIONS, STATUS_STYLES, MAX_TASK_LENGTH } from '../lib/status';
import { formatRelativeTime } from '../lib/time';

const STORAGE_KEY = 'papan-status-tim:nama';
const POLL_INTERVAL_MS = 5000;

export default function Page() {
  const [myName, setMyName] = useState(null);
  const [nameChecked, setNameChecked] = useState(false);
  const [pickerValue, setPickerValue] = useState(TEAM_MEMBERS[0] || '');

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [taskInput, setTaskInput] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingTask, setSavingTask] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const taskInitialized = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && TEAM_MEMBERS.includes(saved)) {
      setMyName(saved);
    }
    setNameChecked(true);
  }, []);

  async function fetchMembers() {
    try {
      const res = await fetch('/api/status', { cache: 'no-store' });
      if (!res.ok) throw new Error('gagal ambil data');
      const data = await res.json();
      setMembers(data.members);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMembers();
    const id = setInterval(fetchMembers, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!myName || taskInitialized.current) return;
    const mine = members.find((m) => m.name === myName);
    if (mine) {
      setTaskInput(mine.task);
      taskInitialized.current = true;
    }
  }, [members, myName]);

  function chooseName() {
    window.localStorage.setItem(STORAGE_KEY, pickerValue);
    setMyName(pickerValue);
  }

  function changeName() {
    window.localStorage.removeItem(STORAGE_KEY);
    taskInitialized.current = false;
    setTaskInput('');
    setMyName(null);
  }

  const myEntry = members.find((m) => m.name === myName);
  const myStatus = myEntry?.status || STATUS_OPTIONS[0];

  async function saveUpdate({ status, task }) {
    const res = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: myName, status, task }),
    });
    if (!res.ok) throw new Error('gagal simpan');
    const updated = await res.json();
    setMembers((prev) =>
      prev.map((m) => (m.name === myName ? { ...m, ...updated } : m))
    );
  }

  async function handleStatusClick(status) {
    if (!myName || savingStatus) return;
    setSavingStatus(true);
    try {
      await saveUpdate({ status, task: taskInput });
    } catch {
      setError(true);
    } finally {
      setSavingStatus(false);
    }
  }

  async function handleSaveTask() {
    if (!myName || savingTask) return;
    setSavingTask(true);
    try {
      await saveUpdate({ status: myStatus, task: taskInput });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch {
      setError(true);
    } finally {
      setSavingTask(false);
    }
  }

  if (!nameChecked) {
    return null;
  }

  return (
    <main className="page">
      <div className="header">
        <h1>Papan Status Tim</h1>
        <p>Lihat siapa sedang mengerjakan apa</p>
      </div>

      {!myName ? (
        <div className="picker-card">
          <h2>Anda siapa?</h2>
          <select
            className="picker-select"
            value={pickerValue}
            onChange={(e) => setPickerValue(e.target.value)}
          >
            {TEAM_MEMBERS.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="picker-confirm"
            onClick={chooseName}
            disabled={!pickerValue}
          >
            Ini saya, lanjutkan
          </button>
        </div>
      ) : (
        <div className="top-bar">
          <span className="you-label">
            Anda: <strong>{myName}</strong>{' '}
            <button className="link-button" onClick={changeName}>
              (ganti)
            </button>
          </span>
          <button className="refresh-button" onClick={fetchMembers}>
            🔄 Perbarui
          </button>
        </div>
      )}

      {loading && <p className="loading-text">Memuat data...</p>}
      {!loading && error && (
        <p className="error-text">
          Gagal memuat data. Coba tekan tombol Perbarui.
        </p>
      )}

      {!loading && members.length > 0 && (
        <div className="member-list">
          {members.map((member) => {
            const isMine = member.name === myName;
            const style = STATUS_STYLES[member.status];
            return (
              <div
                key={member.name}
                className={`member-card${isMine ? ' is-mine' : ''}`}
                style={{ borderLeftColor: style.border }}
              >
                {isMine && <span className="mine-tag">Kartu Anda</span>}
                <div className="member-top">
                  <p className="member-name">{member.name}</p>
                  <span
                    className="status-badge"
                    style={{ background: style.bg, color: style.text }}
                  >
                    {member.status}
                  </span>
                </div>
                <p className={`member-task${member.task ? '' : ' empty'}`}>
                  {member.task || 'Belum ada tugas diisi'}
                </p>
                <p className="member-updated">
                  {formatRelativeTime(member.updatedAt)}
                </p>

                {isMine && (
                  <div className="edit-section">
                    <div className="status-buttons">
                      {STATUS_OPTIONS.map((option) => {
                        const optStyle = STATUS_STYLES[option];
                        const active = option === myStatus;
                        return (
                          <button
                            key={option}
                            className={`status-button${active ? ' active' : ''}`}
                            style={
                              active
                                ? {
                                    background: optStyle.bg,
                                    color: optStyle.text,
                                  }
                                : undefined
                            }
                            disabled={savingStatus}
                            onClick={() => handleStatusClick(option)}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      className="task-input"
                      type="text"
                      maxLength={MAX_TASK_LENGTH}
                      placeholder="Tugas singkat, contoh: Desain banner klien X"
                      value={taskInput}
                      onChange={(e) => setTaskInput(e.target.value)}
                    />
                    <button
                      className="save-button"
                      onClick={handleSaveTask}
                      disabled={savingTask}
                    >
                      {savingTask ? 'Menyimpan...' : 'Simpan Tugas'}
                    </button>
                    {justSaved && <p className="saved-note">Tersimpan ✓</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
