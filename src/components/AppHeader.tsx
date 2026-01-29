import React from 'react';
import { Link } from 'react-router-dom';

export default function AppHeader() {
  return (
    <header className="w-full bg-background border-b border-border p-3">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Link to="/" className="flex items-center no-underline">
          <img src="/logo.svg" alt="App logo" className="w-8 h-8 rounded-md bg-white p-1" />
          <span className="ml-2 font-display font-semibold text-lg text-foreground">Hostel Mess</span>
        </Link>
      </div>
    </header>
  );
}
