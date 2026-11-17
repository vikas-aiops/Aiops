import {
  Baby, Bike, BookOpen, Briefcase, Bus, Cake, Car, Coffee, Coins, Droplets, Dumbbell, Fuel, Gamepad2, Gift,
  GraduationCap, Heart, HeartPulse, Home, Landmark, Laptop, MoreHorizontal, Music, Palette, PawPrint, Pill, Pizza,
  Plane, Popcorn, Receipt, Scissors, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sofa, Sprout, Train, TreePalm,
  Tv, UtensilsCrossed, Wifi, Wrench, Zap,
} from 'lucide-react';

// Category icons are stored by lucide component name in the database.
export const CATEGORY_ICONS = {
  UtensilsCrossed, Car, Home, HeartPulse, Popcorn, ShoppingBag, Plane, Receipt, GraduationCap, MoreHorizontal,
  Coffee, Pizza, ShoppingCart, Bus, Train, Bike, Fuel, Pill, Dumbbell, Shirt, Smartphone, Laptop, Wifi, Zap,
  Droplets, Tv, Gamepad2, Music, BookOpen, Briefcase, Gift, Cake, PawPrint, Baby, Scissors, Wrench, Sofa, Sprout,
  TreePalm, Landmark, Coins, Palette, Heart,
};

// The curated set offered in the icon picker (about 40).
export const ICON_PICKER = Object.keys(CATEGORY_ICONS);

export const iconFor = (name) => CATEGORY_ICONS[name] || MoreHorizontal;

// Category palette: 10 mid-saturation hues, each >= 3:1 contrast on paper.
export const CATEGORY_PALETTE = [
  { hex: '#C8663B', name: 'Terracotta' },
  { hex: '#3D7EA6', name: 'Harbour blue' },
  { hex: '#7A5BA6', name: 'Violet' },
  { hex: '#C2476A', name: 'Rose' },
  { hex: '#A8771F', name: 'Ochre' },
  { hex: '#2E8C7E', name: 'Teal' },
  { hex: '#4F6FC4', name: 'Indigo' },
  { hex: '#A65B8D', name: 'Plum' },
  { hex: '#5C8A3A', name: 'Moss' },
  { hex: '#7A7F8C', name: 'Slate' },
];
