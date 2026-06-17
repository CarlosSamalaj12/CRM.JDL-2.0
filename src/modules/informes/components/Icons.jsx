import React from 'react';
import {
  Calendar,
  Grid,
  Package,
  ChefHat,
  FileText,
  Users,
  CheckCircle,
  Clock,
  MapPin,
  User,
  Plus,
  Trash2,
  ArrowLeft,
  Printer,
  Eye,
  TrendingUp,
  Home,
  Building,
  Tag,
  Menu,
  LogOut,
  Download,
  GripVertical,
  X,
  MessageCircle,
  Send,
  AtSign,
  Star,
  History,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Sun,
  Moon,
  Settings,
  Bell,
  ClipboardList,
} from 'lucide-react';

// Wrapper helper that sets standard props, adds our modern styles and micro-animations
const wrapIcon = (LucideIcon, defaultClass = '') => {
  return ({ size = 18, className = '', ...props }) => {
    return (
      <LucideIcon
        size={size}
        className={`crm-icon ${defaultClass} ${className}`}
        {...props}
      />
    );
  };
};

export const IconCalendar = wrapIcon(Calendar, 'crm-icon-calendar');
export const IconGrid = wrapIcon(Grid, 'crm-icon-grid');
export const IconPackage = wrapIcon(Package, 'crm-icon-package');
export const IconChefHat = wrapIcon(ChefHat, 'crm-icon-chefhat');
export const IconFileText = wrapIcon(FileText, 'crm-icon-filetext');
export const IconUsers = wrapIcon(Users, 'crm-icon-users');
export const IconCheckCircle = wrapIcon(CheckCircle, 'crm-icon-checkcircle');
export const IconClock = wrapIcon(Clock, 'crm-icon-clock');
export const IconMapPin = wrapIcon(MapPin, 'crm-icon-mappin');
export const IconUser = wrapIcon(User, 'crm-icon-user');
export const IconPlus = wrapIcon(Plus, 'crm-icon-plus');
export const IconTrash = wrapIcon(Trash2, 'crm-icon-trash');
export const IconArrowLeft = wrapIcon(ArrowLeft, 'crm-icon-arrowleft');
export const IconPrinter = wrapIcon(Printer, 'crm-icon-printer');
export const IconEye = wrapIcon(Eye, 'crm-icon-eye');
export const IconTrendingUp = wrapIcon(TrendingUp, 'crm-icon-trendingup');
export const IconHome = wrapIcon(Home, 'crm-icon-home');
export const IconBuilding = wrapIcon(Building, 'crm-icon-building');
export const IconTag = wrapIcon(Tag, 'crm-icon-tag');
export const IconMenu = wrapIcon(Menu, 'crm-icon-menu');
export const IconLogOut = wrapIcon(LogOut, 'crm-icon-logout');
export const IconDownload = wrapIcon(Download, 'crm-icon-download');
export const IconGripVertical = wrapIcon(GripVertical, 'crm-icon-gripvertical');
export const IconX = wrapIcon(X, 'crm-icon-x');
export const IconMessageCircle = wrapIcon(MessageCircle, 'crm-icon-messagecircle');
export const IconSend = wrapIcon(Send, 'crm-icon-send');
export const IconAtSign = wrapIcon(AtSign, 'crm-icon-atsign');
export const IconStar = wrapIcon(Star, 'crm-icon-star');
export const IconHistory = wrapIcon(History, 'crm-icon-history');
export const IconAlertCircle = wrapIcon(AlertCircle, 'crm-icon-alertcircle');
export const IconChevronDown = wrapIcon(ChevronDown, 'crm-icon-chevrondown');
export const IconChevronUp = wrapIcon(ChevronUp, 'crm-icon-chevronup');
export const IconSearch = wrapIcon(Search, 'crm-icon-search');
export const IconSun = wrapIcon(Sun, 'crm-icon-sun');
export const IconMoon = wrapIcon(Moon, 'crm-icon-moon');
export const IconSettings = wrapIcon(Settings, 'crm-icon-settings');
export const IconBell = wrapIcon(Bell, 'crm-icon-bell');
export const IconClipboardList = wrapIcon(ClipboardList, 'crm-icon-clipboard');
