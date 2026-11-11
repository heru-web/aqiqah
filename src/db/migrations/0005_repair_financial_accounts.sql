INSERT INTO accounts (code, name, type, "group", is_postable, is_active, is_system)
VALUES ('5-1210', 'Beban Gaji', 'EXPENSE', 'Beban', true, true, true),
       ('1-1320', 'Piutang Karyawan', 'ASSET', 'Piutang', true, true, true)
ON CONFLICT (code) DO NOTHING;
