-- Clean start: Drop tables with CASCADE to handle dependencies automatically
drop table if exists rentals cascade;
drop table if exists cameras cascade;
drop table if exists profiles cascade;

-- Create profiles table
create table profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text check (role in ('buyer', 'seller')),
  created_at timestamptz default now()
);

-- Create cameras table
create table cameras (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references profiles(id) not null,
  name text not null,
  description text,
  price_per_day numeric not null,
  image_url text,
  available boolean default true,
  created_at timestamptz default now()
);

-- Create rentals table
create table rentals (
  id uuid default gen_random_uuid() primary key,
  camera_id uuid references cameras(id) not null,
  buyer_id uuid references profiles(id) not null,
  start_date date not null,
  end_date date not null,
  total_price numeric not null,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected', 'completed')),
  created_at timestamptz default now()
);
create policy "Users can see own rentals" on rentals for select using (
  auth.uid() = buyer_id or 
  camera_id in (select id from cameras where owner_id = auth.uid())
);
