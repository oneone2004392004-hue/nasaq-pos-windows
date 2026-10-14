import { LucideIcon } from 'lucide-react';

export interface NavSubItem {
  id: string;
  title: string;
  path: string;
  badge?: string | number;
}

export interface NavItem {
  id: string;
  title: string;
  path: string;
  iconName: string;
  badge?: string | number;
  subItems?: NavSubItem[];
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}
