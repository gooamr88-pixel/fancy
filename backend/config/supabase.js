const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Polyfill WebSocket for Node.js < 22 to support Supabase Realtime
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if using local fallback database
const isLocalDB = !supabaseUrl || supabaseUrl.includes('your-project') || !supabaseServiceKey;

let supabase;

if (!isLocalDB) {
  console.log('🔌 Connecting to remote Supabase instance...');
  supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: {
      webSocket: global.WebSocket,
      transport: global.WebSocket
    }
  });
} else {
  console.log('📂 No remote database configured. Initializing local JSON Database (db.json)...');
  
  const dbPath = path.join(__dirname, '../db.json');
  
  // Seed data structure
  const defaultData = {
    organizations: [
      { id: 'demo-org', name: 'Demo Organization', email: 'organizer@fancyrsvp.com', stripe_customer_id: 'cust_demo', owner_user_id: 'demo-user' }
    ],
    events: [
      {
        id: 'demo-event',
        org_id: 'demo-org',
        slug: 'demo',
        title: 'Sophia & Julian Wedding Gala',
        title_ar: 'حفل زفاف صوفيا وجوليان الأنيق',
        description: 'Join us as we celebrate our love and write the next chapter of our story together.',
        description_ar: 'يسعدنا انضمامكم إلينا لمشاركتنا فرحة العمر والاحتفال بعهد حبنا الجديد.',
        event_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 60).toISOString(),
        location_name: 'The Glasshouse Chelsea',
        location_address: '545 W 25th St, New York, NY 10001',
        template_type: 'wedding',
        dress_code: 'Black Tie Optional',
        dress_code_ar: 'ملابس رسمية أنيقة (Black Tie)',
        is_paid: true,
        status: 'active',
        created_at: new Date().toISOString()
      }
    ],
    rsvp_form_fields: [
      { id: 'field-1', event_id: 'demo-event', field_key: 'meal', field_label: 'Meal Choice', field_label_ar: 'وجبة العشاء المفضلة', field_type: 'select', options: ['Beef Tenderloin', 'Pan-Seared Salmon', 'Wild Mushroom Risotto (V)', 'Kids Meal'], options_ar: ['شريحة لحم فيليه فاخرة', 'سمك السلمون الأطلسي', 'ريزوتو الفطر البري (نباتي)', 'وجبة أطفال'], is_required: true },
      { id: 'field-2', event_id: 'demo-event', field_key: 'allergies', field_label: 'Dietary Restrictions / Allergies', field_label_ar: 'الحساسية من بعض الأطعمة', field_type: 'text', is_required: false }
    ],
    tables: [
      { id: 't-1', event_id: 'demo-event', table_name: 'VIP Table', max_capacity: 8, shape: 'round', position_x: 20, position_y: 20 },
      { id: 't-2', event_id: 'demo-event', table_name: 'Table 1', max_capacity: 10, shape: 'round', position_x: 60, position_y: 20 },
      { id: 't-3', event_id: 'demo-event', table_name: 'Table 2', max_capacity: 10, shape: 'rectangular', position_x: 20, position_y: 60 }
    ],
    rsvps: [
      { id: 'r-1', event_id: 'demo-event', guest_name: 'Elizabeth Bennet', email: 'elizabeth@bennet.com', phone: '555-1234', response: 'yes', party_size: 2, notes: 'Excited!' },
      { id: 'r-2', event_id: 'demo-event', guest_name: 'Fitzwilliam Darcy', email: 'darcy@pemberley.com', phone: '555-4321', response: 'yes', party_size: 1, notes: 'Attending.' },
      { id: 'r-3', event_id: 'demo-event', guest_name: 'Charles Bingley', email: 'charles@bingley.com', phone: '555-5555', response: 'pending', party_size: 2, notes: '' }
    ],
    rsvp_guests: [
      { id: 'rg-1', rsvp_id: 'r-1', full_name: 'Elizabeth Bennet', is_primary: true, meal_selection: 'Atlantic Salmon' },
      { id: 'rg-2', rsvp_id: 'r-1', full_name: 'Jane Bennet', is_primary: false, meal_selection: 'Wild Mushroom Risotto (V)' },
      { id: 'rg-3', rsvp_id: 'r-2', full_name: 'Fitzwilliam Darcy', is_primary: true, meal_selection: 'Prime Beef Filet' }
    ],
    seating_assignments: [
      { id: 'sa-1', event_id: 'demo-event', rsvp_id: 'r-1', table_id: 't-1' }
    ],
    check_ins: [],
    event_payments: [],
    sms_credit_wallets: [
      { id: 'w-1', event_id: 'demo-event', credits_purchased: 100, credits_used: 10 }
    ],
    sms_credit_ledger: [],
    super_admin_config: [{ id: '00000000-0000-0000-0000-000000000000', pricing_tiers: [], sms_rate_cents_per_credit: 8 }],
    custom_answers: [],
    activity_logs: [],
    user_roles: [
      { id: 'role-1', user_id: 'demo-user', role: 'organizer' },
      { id: 'role-2', user_id: 'admin-user', role: 'super_admin' }
    ]
  };

  const getDB = () => {
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify(defaultData, null, 2));
    }
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    // Ensure all tables are present as arrays to handle schema upgrades on existing db.json files
    if (!db.custom_answers) db.custom_answers = [];
    if (!db.super_admin_config) {
      db.super_admin_config = [{ id: '00000000-0000-0000-0000-000000000000', pricing_tiers: [], sms_rate_cents_per_credit: 8 }];
    } else if (!Array.isArray(db.super_admin_config)) {
      db.super_admin_config = [db.super_admin_config];
    }
    if (!db.activity_logs) db.activity_logs = [];
    if (!db.sms_credit_wallets) db.sms_credit_wallets = [];
    if (!db.sms_credit_ledger) db.sms_credit_ledger = [];
    if (!db.event_payments) db.event_payments = [];
    if (!db.check_ins) db.check_ins = [];
    if (!db.seating_assignments) db.seating_assignments = [];
    if (!db.rsvp_guests) db.rsvp_guests = [];
    if (!db.rsvps) db.rsvps = [];
    if (!db.tables) db.tables = [];
    if (!db.rsvp_form_fields) db.rsvp_form_fields = [];
    if (!db.events) db.events = [];
    if (!db.user_roles) {
      db.user_roles = [
        { id: 'role-1', user_id: 'demo-user', role: 'organizer' },
        { id: 'role-2', user_id: 'admin-user', role: 'super_admin' }
      ];
    }
    if (!db.organizations) db.organizations = [];
    
    return db;
  };

  const saveDB = (data) => {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  };

  // Mock Query Builder mimicking Supabase JS API
  class MockQueryBuilder {
    constructor(tableName) {
      this.tableName = tableName;
      this.filters = [];
      this.limitCount = null;
      this.singleResult = false;
      this.orderBy = null;
    }

    select(columns) { return this; }

    eq(column, value) {
      this.filters.push({ type: 'eq', column, value });
      return this;
    }

    not(column, operator, value) {
      if (operator === 'is' && value === null) {
        this.filters.push({ type: 'notNull', column });
      }
      return this;
    }

    ilike(column, pattern) {
      this.filters.push({ type: 'ilike', column, pattern });
      return this;
    }

    in(column, values) {
      this.filters.push({ type: 'in', column, values });
      return this;
    }

    order(column, options) {
      this.orderBy = { column, ascending: options?.ascending !== false };
      return this;
    }

    limit(num) {
      this.limitCount = num;
      return this;
    }

    single() {
      this.singleResult = true;
      return this;
    }

    insert(records) {
      this.insertData = records;
      return this;
    }

    update(updates) {
      this.updateData = updates;
      return this;
    }

    delete() {
      this.shouldDelete = true;
      return this;
    }

    // Execution trigger: then() allows using "await" directly on the builder instance
    async then(onfulfilled) {
      try {
        const db = getDB();

        // 1. Handle INSERT execution
        if (this.insertData) {
          const records = this.insertData;
          const rows = Array.isArray(records) ? records : [records];
          const newRows = rows.map(r => {
            const row = { ...r };
            if (!row.id) row.id = 'gen-' + Math.random().toString(36).substring(2, 11);
            if (!row.created_at) row.created_at = new Date().toISOString();
            return row;
          });
          db[this.tableName] = [...(db[this.tableName] || []), ...newRows];
          saveDB(db);

          const resultData = Array.isArray(records) ? newRows : newRows[0];
          const resolved = onfulfilled ? onfulfilled({ data: resultData, error: null }) : { data: resultData, error: null };
          return resolved;
        }

        // 2. Handle UPDATE execution
        if (this.updateData) {
          const updates = this.updateData;
          let rows = db[this.tableName] || [];

          rows = rows.map(row => {
            let match = true;
            for (const f of this.filters) {
              if (f.type === 'eq' && row[f.column] !== f.value) match = false;
            }
            if (match) {
              return { ...row, ...updates, updated_at: new Date().toISOString() };
            }
            return row;
          });

          db[this.tableName] = rows;
          saveDB(db);

          const updated = rows.filter(row => {
            let match = true;
            for (const f of this.filters) {
              if (f.type === 'eq' && row[f.column] !== f.value) match = false;
            }
            return match;
          });

          const resultData = this.singleResult ? (updated[0] || null) : updated;
          const resolved = onfulfilled ? onfulfilled({ data: resultData, error: null }) : { data: resultData, error: null };
          return resolved;
        }

        // 3. Handle DELETE execution
        if (this.shouldDelete) {
          db[this.tableName] = (db[this.tableName] || []).filter(row => {
            let match = true;
            for (const f of this.filters) {
              if (f.type === 'eq' && row[f.column] !== f.value) match = false;
            }
            return !match;
          });
          saveDB(db);

          const resolved = onfulfilled ? onfulfilled({ data: null, error: null }) : { data: null, error: null };
          return resolved;
        }

        // 4. Handle SELECT execution
        let rows = db[this.tableName] || [];

        // Apply filters
        for (const f of this.filters) {
          if (f.type === 'eq') {
            rows = rows.filter(row => row[f.column] === f.value);
          } else if (f.type === 'notNull') {
            rows = rows.filter(row => row[f.column] !== null && row[f.column] !== undefined);
          } else if (f.type === 'ilike') {
            const regex = new RegExp(f.pattern.replace(/%/g, '.*'), 'i');
            rows = rows.filter(row => regex.test(row[f.column] || ''));
          } else if (f.type === 'in') {
            rows = rows.filter(row => f.values && f.values.includes(row[f.column]));
          }
        }

        // Apply order
        if (this.orderBy) {
          const { column, ascending } = this.orderBy;
          rows.sort((a, b) => {
            if (a[column] < b[column]) return ascending ? -1 : 1;
            if (a[column] > b[column]) return ascending ? 1 : -1;
            return 0;
          });
        }

        // Resolve joins (embedded objects mocks for tables/rsvps relation maps)
        if (this.tableName === 'seating_assignments') {
          rows = rows.map(sa => {
            const table = db.tables.find(t => t.id === sa.table_id);
            const rsvp = db.rsvps.find(r => r.id === sa.rsvp_id);
            const event = db.events.find(e => e.id === sa.event_id);
            return {
              ...sa,
              tables: table ? { table_name: table.table_name } : null,
              rsvps: rsvp ? { party_size: rsvp.party_size, guest_name: rsvp.guest_name, email: rsvp.email } : null,
              events: event ? { title: event.title, event_date: event.event_date } : null
            };
          });
        } else if (this.tableName === 'events') {
          rows = rows.map(event => {
            const fields = db.rsvp_form_fields.filter(f => f.event_id === event.id);
            const org = db.organizations.find(o => o.id === event.org_id);
            return {
              ...event,
              rsvp_form_fields: fields,
              organizations: org ? { stripe_customer_id: org.stripe_customer_id, email: org.email, name: org.name, owner_user_id: org.owner_user_id } : null
            };
          });
        } else if (this.tableName === 'sms_credit_wallets') {
          rows = rows.map(wallet => ({
            ...wallet,
            credits_remaining: (wallet.credits_purchased || 0) - (wallet.credits_used || 0)
          }));
        } else if (this.tableName === 'rsvps') {
          rows = rows.map(rsvp => {
            const guests = db.rsvp_guests.filter(rg => rg.rsvp_id === rsvp.id);
            const custom = db.custom_answers.filter(ca => ca.rsvp_id === rsvp.id);
            const event = db.events.find(e => e.id === rsvp.event_id);
            const sa = db.seating_assignments.filter(s => s.rsvp_id === rsvp.id);
            const checkins = db.check_ins.filter(c => c.rsvp_id === rsvp.id);
            return {
              ...rsvp,
              rsvp_guests: guests,
              custom_answers: custom,
              events: event ? { title: event.title, event_date: event.event_date } : null,
              seating_assignments: sa.map(s => {
                const table = db.tables.find(t => t.id === s.table_id);
                return { 
                  table_id: s.table_id,
                  tables: table ? { table_name: table.table_name } : null 
                };
              }),
              check_ins: checkins.map(c => ({ id: c.id, checked_in_at: c.checked_in_at }))
            };
          });
        }

        let result = rows;
        if (this.singleResult) {
          result = rows[0] || null;
        } else if (this.limitCount) {
          result = rows.slice(0, this.limitCount);
        }

        const resolved = onfulfilled ? onfulfilled({ data: result, error: null }) : { data: result, error: null };
        return resolved;
      } catch (err) {
        console.error('LocalDB Query Error:', err);
        return { data: null, error: err };
      }
    }
  }

  // Exposed API
  supabase = {
    from: (tableName) => new MockQueryBuilder(tableName),
    
    rpc: async (fnName, params) => {
      const db = getDB();
      try {
        if (fnName === 'assign_seat') {
          const { p_event_id, p_rsvp_id, p_table_id } = params;
          
          // Check existing
          const existing = db.seating_assignments.find(sa => sa.event_id === p_event_id && sa.rsvp_id === p_rsvp_id);
          if (existing) {
            return { data: { success: false, error: 'ALREADY_ASSIGNED', message: 'Guest is already seated.' }, error: null };
          }

          // Check capacity
          const table = db.tables.find(t => t.id === p_table_id);
          const occupied = db.seating_assignments
            .filter(sa => sa.table_id === p_table_id)
            .reduce((acc, curr) => {
              const rsvp = db.rsvps.find(r => r.id === curr.rsvp_id);
              return acc + (rsvp ? rsvp.party_size : 0);
            }, 0);
          
          const rsvp = db.rsvps.find(r => r.id === p_rsvp_id);
          const partySize = rsvp ? rsvp.party_size : 1;
          const remaining = table.max_capacity - occupied;

          if (partySize > remaining) {
            return { data: { success: false, error: 'CAPACITY_EXCEEDED', message: `Table only has ${remaining} seats left.` }, error: null };
          }

          // Add seating
          const newAssign = {
            id: 'sa-' + Math.random().toString(36).substring(2, 9),
            event_id: p_event_id,
            rsvp_id: p_rsvp_id,
            table_id: p_table_id,
            assigned_at: new Date().toISOString()
          };
          db.seating_assignments.push(newAssign);
          saveDB(db);

          return { data: { success: true, assignment_id: newAssign.id, seats_remaining: remaining - partySize }, error: null };
        }
        
        if (fnName === 'reassign_seat') {
          const { p_event_id, p_rsvp_id, p_new_table_id } = params;
          const oldAssignIndex = db.seating_assignments.findIndex(sa => sa.event_id === p_event_id && sa.rsvp_id === p_rsvp_id);
          if (oldAssignIndex === -1) {
            return { data: { success: false, error: 'NOT_ASSIGNED' }, error: null };
          }

          const table = db.tables.find(t => t.id === p_new_table_id);
          const occupied = db.seating_assignments
            .filter(sa => sa.table_id === p_new_table_id)
            .reduce((acc, curr) => {
              const rsvp = db.rsvps.find(r => r.id === curr.rsvp_id);
              return acc + (rsvp ? rsvp.party_size : 0);
            }, 0);

          const rsvp = db.rsvps.find(r => r.id === p_rsvp_id);
          const partySize = rsvp ? rsvp.party_size : 1;
          const remaining = table.max_capacity - occupied;

          if (partySize > remaining) {
            return { data: { success: false, error: 'CAPACITY_EXCEEDED' }, error: null };
          }

          db.seating_assignments[oldAssignIndex].table_id = p_new_table_id;
          saveDB(db);

          return { data: { success: true, from_table: 'Previous Table', to_table: table.table_name, seats_remaining_new_table: remaining - partySize }, error: null };
        }

        if (fnName === 'deduct_sms_credit') {
          const { p_event_id, p_phone, p_sms_sid } = params;
          const wallet = db.sms_credit_wallets.find(w => w.event_id === p_event_id);
          if (wallet) {
            wallet.credits_used += 1;
            db.sms_credit_ledger.push({
              id: 'led-' + Math.random().toString(36).substring(2, 9),
              wallet_id: wallet.id,
              event_id: p_event_id,
              transaction_type: 'consumption',
              credits: -1,
              sms_recipient: p_phone,
              sms_sid: p_sms_sid,
              created_at: new Date().toISOString()
            });
            saveDB(db);
          }
          return { data: null, error: null };
        }
      } catch (err) {
        return { data: null, error: err };
      }
    },

    channel: (channelName) => ({
      send: async () => true,
      subscribe: () => {}
    }),

    raw: (sql) => sql // Dummy helper
  };
}

module.exports = { supabase };
