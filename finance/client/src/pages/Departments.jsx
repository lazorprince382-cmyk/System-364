import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Eye, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import { formatQty, formatUGX, todayISO } from '../config/school';
import PeriodFilter, { filterFromSearchParams, periodParams } from '../components/PeriodFilter';
import { useAuth } from '../context/AuthContext';

export default function Departments() {
  const { canEdit } = useAuth();
  const [searchParams] = useSearchParams();
  const [departments, setDepartments] = useState([]);
  const [deptId, setDeptId] = useState(searchParams.get('department_id') || '');
  const [filter, setFilter] = useState(() => filterFromSearchParams(searchParams));
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'expenses');
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [stock, setStock] = useState([]);
  const [issues, setIssues] = useState([]);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', has_inventory: false });
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    expense_date: todayISO(),
    purpose: '',
    taken_by: '',
    notes: '',
  });
  const [purchaseMeta, setPurchaseMeta] = useState({
    purchase_date: todayISO(),
    notes: '',
  });
  const [purchaseLines, setPurchaseLines] = useState([
    { material: '', quantity: '1', unit_cost: '', amount: '' },
  ]);
  const [issueMeta, setIssueMeta] = useState({
    issue_date: todayISO(),
    taken_by: '',
    notes: '',
  });
  const [issueLines, setIssueLines] = useState([{ stock_id: '', quantity: '1' }]);
  const [manageOpen, setManageOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [busyDl, setBusyDl] = useState(false);

  useEffect(() => {
    if (!manageOpen && !reportsOpen) return undefined;
    const onDoc = (e) => {
      if (!e.target.closest('[data-dept-menu]')) {
        setManageOpen(false);
        setReportsOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [manageOpen, reportsOpen]);

  const selected = departments.find((d) => String(d.id) === String(deptId));
  const hasInv = Boolean(selected?.has_inventory);

  useEffect(() => {
    const fromUrl = searchParams.get('department_id');
    const tabUrl = searchParams.get('tab');
    if (fromUrl) setDeptId(fromUrl);
    if (tabUrl) setTab(tabUrl);
  }, [searchParams]);

  useEffect(() => {
    api.departments.list().then((rows) => {
      setDepartments(rows);
      const fromUrl = searchParams.get('department_id');
      if (fromUrl) setDeptId(fromUrl);
      else if (!deptId && rows[0]) setDeptId(String(rows[0].id));
    }).catch((e) => setError(e.message));
  }, []);

  const load = () => {
    if (!deptId) return;
    const p = periodParams(filter);
    setError('');
    api.departments.summary(deptId, p).then(setSummary).catch((e) => setError(e.message));
    api.departments.expensesList(deptId, p).then(setExpenses).catch((e) => setError(e.message));
    const inv = departments.find((d) => String(d.id) === String(deptId))?.has_inventory;
    if (inv) {
      api.departments.purchasesList(deptId, p).then(setPurchases).catch(() => {});
      api.departments.stock(deptId).then(setStock).catch(() => {});
      api.departments.issuesList(deptId, p).then(setIssues).catch(() => {});
    } else {
      setPurchases([]);
      setStock([]);
      setIssues([]);
      if (tab !== 'expenses') setTab('expenses');
    }
  };

  useEffect(() => {
    load();
  }, [deptId, filter, departments]);

  const addDepartment = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const row = await api.departments.create(newDept);
      const list = await api.departments.list();
      setDepartments(list);
      setDeptId(String(row.id));
      setNewDept({ name: '', has_inventory: false });
      setShowAdd(false);
    } catch (err) {
      setError(err.message);
    }
  };

  const toggleInventory = async () => {
    if (!selected) return;
    setManageOpen(false);
    try {
      const row = await api.departments.update(selected.id, {
        has_inventory: !selected.has_inventory,
      });
      setDepartments((d) => d.map((x) => (x.id === row.id ? row : x)));
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteDepartment = async () => {
    if (!selected) return;
    const ok = window.confirm(
      `Remove department “${selected.name}”? It will disappear from the list. Past records stay in reports if needed.`
    );
    if (!ok) return;
    setManageOpen(false);
    setError('');
    try {
      await api.departments.remove(selected.id);
      const list = await api.departments.list();
      setDepartments(list);
      setDeptId(list[0] ? String(list[0].id) : '');
    } catch (err) {
      setError(err.message);
    }
  };

  const saveExpense = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.departments.expensesCreate(deptId, expenseForm);
      setExpenseForm((f) => ({ ...f, amount: '', purpose: '', taken_by: '', notes: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const savePurchase = async (e) => {
    e.preventDefault();
    setError('');
    const items = purchaseLines
      .filter((l) => l.material.trim() && Number(l.quantity) > 0)
      .map((l) => ({
        material: l.material.trim(),
        quantity: l.quantity,
        unit_cost: l.unit_cost === '' ? null : l.unit_cost,
        amount: l.amount === '' ? null : l.amount,
      }));
    if (!items.length) {
      setError('Add at least one material with quantity');
      return;
    }
    try {
      await api.departments.purchasesCreate(deptId, { ...purchaseMeta, items });
      setPurchaseMeta({ purchase_date: todayISO(), notes: '' });
      setPurchaseLines([{ material: '', quantity: '1', unit_cost: '', amount: '' }]);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const saveIssue = async (e) => {
    e.preventDefault();
    setError('');
    const items = issueLines
      .filter((l) => l.stock_id && Number(l.quantity) > 0)
      .map((l) => ({ stock_id: l.stock_id, quantity: l.quantity }));
    if (!items.length) {
      setError('Add at least one item with quantity');
      return;
    }
    try {
      await api.departments.issuesCreate(deptId, { ...issueMeta, items });
      setIssueMeta({ issue_date: todayISO(), taken_by: '', notes: '' });
      setIssueLines([{ stock_id: stock[0] ? String(stock[0].id) : '', quantity: '1' }]);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (stock[0]) {
      setIssueLines((lines) =>
        lines.map((l) => (l.stock_id ? l : { ...l, stock_id: String(stock[0].id) }))
      );
    }
  }, [stock]);

  const reportTypeForTab = () => {
    if (!deptId) return 'departments';
    if (tab === 'expenses') return 'dept-expenses';
    if (tab === 'purchases') return 'dept-purchases';
    if (tab === 'store') return 'dept-stock';
    if (tab === 'issues') return 'dept-issues';
    return 'department';
  };

  const reportHref = (type) => {
    const p = periodParams(filter);
    const sp = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => {
      if (v != null && v !== '') sp.set(k, v);
    });
    if (deptId) sp.set('department_id', deptId);
    const q = sp.toString();
    return `/reports/view/${type}${q ? `?${q}` : ''}`;
  };

  const download = async (type) => {
    setBusyDl(true);
    setError('');
    try {
      await api.downloadReport(type, {
        ...periodParams(filter),
        department_id: deptId || undefined,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyDl(false);
    }
  };

  const issueBatches = (() => {
    const map = new Map();
    for (const row of issues) {
      const key = row.batch_id || `solo-${row.id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          batch_id: row.batch_id,
          issue_date: row.issue_date,
          taken_by: row.taken_by,
          notes: row.notes,
          lines: [],
        });
      }
      map.get(key).lines.push(row);
    }
    return [...map.values()];
  })();

  const tabs = hasInv
    ? [
        { id: 'expenses', label: 'Expenses' },
        { id: 'purchases', label: 'Purchases' },
        { id: 'store', label: 'Store' },
        { id: 'issues', label: 'Issues' },
      ]
    : [{ id: 'expenses', label: 'Expenses' }];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="page-title">Departments</h2>
          <p className="muted mt-1">
            Pick a department and period. Reports follow the tab you are on.
          </p>
        </div>
        <div className="relative" data-dept-menu>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setReportsOpen((v) => !v);
              setManageOpen(false);
            }}
          >
            <Eye className="w-4 h-4" /> Reports
          </button>
          {reportsOpen && (
            <div className="absolute right-0 mt-2 z-20 w-52 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg p-1">
              <Link
                to={reportHref(reportTypeForTab())}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--theme-bg)]"
                onClick={() => setReportsOpen(false)}
              >
                <Eye className="w-4 h-4" /> View report
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--theme-bg)]"
                disabled={busyDl}
                onClick={() => {
                  setReportsOpen(false);
                  download(reportTypeForTab());
                }}
              >
                <Download className="w-4 h-4" />
                {busyDl ? 'Preparing…' : 'Download Excel'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px] flex-1">
          <label className="label">Department</label>
          <select className="input-field" value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {!departments.length && <option value="">No departments yet</option>}
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.has_inventory ? ' · store' : ''}
              </option>
            ))}
          </select>
        </div>
        {canEdit && (
          <div className="relative" data-dept-menu>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setManageOpen((v) => !v);
                setReportsOpen(false);
              }}
            >
              <MoreHorizontal className="w-4 h-4" /> Manage
            </button>
            {manageOpen && (
              <div className="absolute right-0 mt-2 z-20 w-56 rounded-xl border border-[var(--theme-border)] bg-[var(--theme-surface)] shadow-lg p-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--theme-bg)]"
                  onClick={() => {
                    setManageOpen(false);
                    setShowAdd(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Add department
                </button>
                {selected && (
                  <>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm hover:bg-[var(--theme-bg)]"
                      onClick={toggleInventory}
                    >
                      {selected.has_inventory ? 'Disable store' : 'Enable store inventory'}
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-[var(--theme-bg)]"
                      onClick={deleteDepartment}
                    >
                      <Trash2 className="w-4 h-4" /> Delete department
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAdd && canEdit && (
        <form onSubmit={addDepartment} className="card p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[180px]">
            <label className="label">New department name</label>
            <input
              className="input-field"
              required
              value={newDept.name}
              onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              placeholder="e.g. Library"
            />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2">
            <input
              type="checkbox"
              checked={newDept.has_inventory}
              onChange={(e) => setNewDept({ ...newDept, has_inventory: e.target.checked })}
            />
            Has store inventory
          </label>
          <button type="submit" className="btn-primary">
            Save department
          </button>
          <button type="button" className="btn-ghost" onClick={() => setShowAdd(false)}>
            Cancel
          </button>
        </form>
      )}

      <PeriodFilter value={filter} onChange={setFilter} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {selected && (
        <div className={`grid gap-3 ${hasInv ? 'sm:grid-cols-3' : 'sm:grid-cols-1 max-w-sm'}`}>
          <div className="stat-tile">
            <p className="text-xs uppercase font-semibold muted">Spent (period)</p>
            <p className="text-xl font-bold text-red-700 mt-2">{formatUGX(summary?.spent)}</p>
          </div>
          {hasInv && (
            <>
              <div className="stat-tile">
                <p className="text-xs uppercase font-semibold muted">Items in store</p>
                <p className="text-xl font-bold mt-2">{summary?.stock_items ?? 0}</p>
              </div>
              <div className="stat-tile">
                <p className="text-xs uppercase font-semibold muted">Issues (period)</p>
                <p className="text-xl font-bold mt-2">{summary?.issues_count ?? 0}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`filter-pill ${tab === t.id ? 'filter-pill-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'expenses' && selected && (
        <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
          {canEdit && (
            <form onSubmit={saveExpense} className="card p-5 lg:col-span-2 space-y-3">
              <h3 className="font-semibold">New {selected.name} expense</h3>
              <div>
                <label className="label">Amount (UGX)</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  required
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  required
                  value={expenseForm.expense_date}
                  onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Purpose / use of money</label>
                <input
                  className="input-field"
                  required
                  value={expenseForm.purpose}
                  onChange={(e) => setExpenseForm({ ...expenseForm, purpose: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Who took</label>
                <input
                  className="input-field"
                  required
                  value={expenseForm.taken_by}
                  onChange={(e) => setExpenseForm({ ...expenseForm, taken_by: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Notes</label>
                <input
                  className="input-field"
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Save expense
              </button>
            </form>
          )}
          <div className={`card p-5 flex flex-col ${canEdit ? 'lg:col-span-3' : ''}`}>
            <div className="flex justify-between mb-3">
              <h3 className="font-semibold">Expense records</h3>
              <p className="text-sm font-semibold text-red-700">{formatUGX(summary?.spent)}</p>
            </div>
            <div className="records-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Purpose</th>
                    <th>Taken by</th>
                    <th>Amount</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((r) => (
                    <tr key={r.id}>
                      <td>{String(r.expense_date).slice(0, 10)}</td>
                      <td>
                        {r.purpose}
                        {r.purchase_id && <div className="text-xs muted">From purchase</div>}
                      </td>
                      <td>{r.taken_by}</td>
                      <td className="font-semibold text-red-700">{formatUGX(r.amount)}</td>
                      {canEdit && (
                        <td>
                          {!r.purchase_id && (
                            <button
                              type="button"
                              className="btn-ghost px-2 text-red-600"
                              onClick={() =>
                                api.departments
                                  .expensesRemove(deptId, r.id)
                                  .then(load)
                                  .catch((e) => setError(e.message))
                              }
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {!expenses.length && (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="muted text-center py-8">
                        No expenses for this department in the period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'purchases' && hasInv && (
        <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
          {canEdit && (
            <form onSubmit={savePurchase} className="card p-5 lg:col-span-2 space-y-3">
              <h3 className="font-semibold">Add to store (one or more items)</h3>
              <p className="text-xs muted">
                Unit cost and amount are optional. Money spent goes on the Expenses tab — store adds stay inventory only.
              </p>
              <div>
                <label className="label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  required
                  value={purchaseMeta.purchase_date}
                  onChange={(e) => setPurchaseMeta({ ...purchaseMeta, purchase_date: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <label className="label">Items</label>
                {purchaseLines.map((line, idx) => (
                  <div
                    key={idx}
                    className="space-y-2 rounded-lg border border-[var(--theme-border)] p-3"
                  >
                    <div>
                      <input
                        className="input-field"
                        required
                        placeholder="Material"
                        value={line.material}
                        onChange={(e) => {
                          const next = [...purchaseLines];
                          next[idx] = { ...next[idx], material: e.target.value };
                          setPurchaseLines(next);
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="label">Qty</label>
                        <input
                          className="input-field"
                          type="number"
                          step="1"
                          min="1"
                          required
                          value={line.quantity}
                          onChange={(e) => {
                            const next = [...purchaseLines];
                            next[idx] = { ...next[idx], quantity: e.target.value };
                            setPurchaseLines(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">Unit (opt.)</label>
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          value={line.unit_cost}
                          onChange={(e) => {
                            const next = [...purchaseLines];
                            next[idx] = { ...next[idx], unit_cost: e.target.value };
                            setPurchaseLines(next);
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">Amount (opt.)</label>
                        <input
                          className="input-field"
                          type="number"
                          min="0"
                          value={line.amount}
                          onChange={(e) => {
                            const next = [...purchaseLines];
                            next[idx] = { ...next[idx], amount: e.target.value };
                            setPurchaseLines(next);
                          }}
                        />
                      </div>
                    </div>
                    {purchaseLines.length > 1 && (
                      <button
                        type="button"
                        className="btn-ghost px-2 text-red-600 text-sm"
                        onClick={() => setPurchaseLines(purchaseLines.filter((_, i) => i !== idx))}
                      >
                        Remove line
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() =>
                    setPurchaseLines([
                      ...purchaseLines,
                      { material: '', quantity: '1', unit_cost: '', amount: '' },
                    ])
                  }
                >
                  <Plus className="w-4 h-4" /> Add another item
                </button>
              </div>
              <button type="submit" className="btn-primary w-full">
                Save to store
              </button>
            </form>
          )}
          <div className={`card p-5 flex flex-col ${canEdit ? 'lg:col-span-3' : ''}`}>
            <h3 className="font-semibold mb-3">Purchases</h3>
            <div className="records-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Material</th>
                    <th>Qty</th>
                    <th>Amount</th>
                    {canEdit && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((r) => (
                    <tr key={r.id}>
                      <td>{String(r.purchase_date).slice(0, 10)}</td>
                      <td>{r.material}</td>
                      <td>{formatQty(r.quantity)}</td>
                      <td className="font-semibold text-red-700">
                        {Number(r.amount) > 0 ? formatUGX(r.amount) : '—'}
                      </td>
                      {canEdit && (
                        <td>
                          <button
                            type="button"
                            className="btn-ghost px-2 text-red-600"
                            onClick={() =>
                              api.departments
                                .purchasesRemove(deptId, r.id)
                                .then(load)
                                .catch((e) => setError(e.message))
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!purchases.length && (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="muted text-center py-8">
                        No purchases in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'store' && hasInv && (
        <div className="card p-5">
          <h3 className="font-semibold mb-3">Store stock</h3>
          <div className="records-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>On hand</th>
                </tr>
              </thead>
              <tbody>
                {stock.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium">{r.material}</td>
                    <td>{formatQty(r.quantity_on_hand)}</td>
                  </tr>
                ))}
                {!stock.length && (
                  <tr>
                    <td colSpan={2} className="muted text-center py-8">
                      Store is empty — record a purchase first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'issues' && hasInv && (
        <div className={`grid gap-4 ${canEdit ? 'lg:grid-cols-5' : ''}`}>
          {canEdit && (
            <form onSubmit={saveIssue} className="card p-5 lg:col-span-2 space-y-3">
              <h3 className="font-semibold">Issue request (one or more items)</h3>
              <p className="text-xs muted">e.g. 1 book + 4 pens in the same request.</p>
              <div>
                <label className="label">Date</label>
                <input
                  className="input-field"
                  type="date"
                  required
                  value={issueMeta.issue_date}
                  onChange={(e) => setIssueMeta({ ...issueMeta, issue_date: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Taken by (teacher / staff)</label>
                <input
                  className="input-field"
                  required
                  value={issueMeta.taken_by}
                  onChange={(e) => setIssueMeta({ ...issueMeta, taken_by: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="label">Items</label>
                {issueLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <select
                        className="input-field"
                        required
                        value={line.stock_id}
                        onChange={(e) => {
                          const next = [...issueLines];
                          next[idx] = { ...next[idx], stock_id: e.target.value };
                          setIssueLines(next);
                        }}
                      >
                        <option value="">Select item</option>
                        {stock
                          .filter((s) => Number(s.quantity_on_hand) > 0)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.material} ({formatQty(s.quantity_on_hand)} on hand)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="w-24">
                      <input
                        className="input-field"
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={line.quantity}
                        onChange={(e) => {
                          const next = [...issueLines];
                          next[idx] = { ...next[idx], quantity: e.target.value };
                          setIssueLines(next);
                        }}
                      />
                    </div>
                    {issueLines.length > 1 && (
                      <button
                        type="button"
                        className="btn-ghost px-2 text-red-600"
                        onClick={() => setIssueLines(issueLines.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-ghost text-sm"
                  onClick={() =>
                    setIssueLines([
                      ...issueLines,
                      { stock_id: stock[0] ? String(stock[0].id) : '', quantity: '1' },
                    ])
                  }
                >
                  <Plus className="w-4 h-4" /> Add another item
                </button>
              </div>
              <div>
                <label className="label">Notes</label>
                <input
                  className="input-field"
                  value={issueMeta.notes}
                  onChange={(e) => setIssueMeta({ ...issueMeta, notes: e.target.value })}
                />
              </div>
              <button type="submit" className="btn-primary w-full">
                Record request
              </button>
            </form>
          )}
          <div className={`card p-5 flex flex-col ${canEdit ? 'lg:col-span-3' : ''}`}>
            <h3 className="font-semibold mb-3">Issue requests</h3>
            <div className="records-scroll space-y-3">
              {issueBatches.map((batch) => (
                <div
                  key={batch.key}
                  className="rounded-xl border border-[var(--theme-border)] p-3"
                >
                  <div className="flex justify-between gap-2 items-start mb-2">
                    <div>
                      <p className="text-sm font-semibold">
                        {String(batch.issue_date).slice(0, 10)} · {batch.taken_by}
                      </p>
                      {batch.batch_id && (
                        <p className="text-xs muted">Request {String(batch.batch_id).slice(0, 8)}</p>
                      )}
                      {batch.notes && <p className="text-xs muted mt-0.5">{batch.notes}</p>}
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-ghost px-2 text-red-600"
                        title="Delete whole request"
                        onClick={() => {
                          const run = batch.batch_id
                            ? api.departments.issuesRemoveBatch(deptId, batch.batch_id)
                            : api.departments.issuesRemove(deptId, batch.lines[0].id);
                          run.then(load).catch((e) => setError(e.message));
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <ul className="text-sm space-y-1">
                    {batch.lines.map((line) => (
                      <li key={line.id} className="flex justify-between gap-2">
                        <span>{line.material}</span>
                        <span className="font-semibold">× {formatQty(line.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {!issueBatches.length && (
                <p className="muted text-center py-8">No issues in this period.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
