// Script to seed testimonials into the database
// Run with: npm run seed (from backend folder)

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Testimonial } from './models/schemas.js';

dotenv.config();

const seedTestimonials = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected:', conn.connection.host);

    // Clear existing testimonials
    await Testimonial.deleteMany({});
    console.log('🧹 Cleared existing testimonials');

    // Create initial testimonials
    const testimonials = [
      {
        name: 'Sarah M.',
        initials: 'SM',
        story: 'I got a flat tire on a deserted road at 2 AM. I was terrified. I tapped the SOS button, and my dad got my location instantly. He called me within seconds and stayed on the line until help arrived. I don\'t know what I would have done without it.',
        status: 'Safe & Sound',
        featureUsed: 'SOS',
        isFeatured: true,
        backgroundColor: '#E3F2FD',
        avatarTextColor: '#6A5ACD'
      },
      {
        name: 'David L.',
        initials: 'DL',
        story: 'I went for a solo hike and twisted my ankle on an unmarked trail. I couldn\'t walk. The Live Location feature helped the search and rescue team pinpoint my exact coordinates, saving them hours of searching.',
        status: 'Rescued',
        featureUsed: 'Live Location',
        isFeatured: true,
        backgroundColor: '#F3E5F5',
        avatarTextColor: '#9C27B0'
      },
      {
        name: 'Marcus T.',
        initials: 'MT',
        story: 'As a delivery driver, I travel through unfamiliar neighborhoods. The Guardian Notify feature alerts my family whenever I enter risky zones. I feel safer knowing they\'re watching out for me.',
        status: 'Protected',
        featureUsed: 'Guardian Notify',
        isFeatured: true,
        backgroundColor: '#FFF0F0',
        avatarTextColor: '#FF4B4B'
      },
      {
        name: 'Jessica P.',
        initials: 'JP',
        story: 'During my late-night commute, SafeNet\'s real-time location sharing kept my mom informed every step of the way. She could see exactly where I was and knew I was safe.',
        status: 'Safe',
        featureUsed: 'Live Location',
        isFeatured: true,
        backgroundColor: '#F0FFF0',
        avatarTextColor: '#00C851'
      }
    ];

    const createdTestimonials = await Testimonial.insertMany(testimonials);
    console.log(`✅ Seeded ${createdTestimonials.length} testimonials successfully!\n`);

    createdTestimonials.forEach((t, idx) => {
      console.log(`  ${idx + 1}. ${t.name} (${t.initials}) - ${t.featureUsed}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding testimonials:', error.message);
    process.exit(1);
  }
};

seedTestimonials();
