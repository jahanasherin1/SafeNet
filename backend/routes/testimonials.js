import express from 'express';
import { Testimonial } from '../models/schemas.js';

const router = express.Router();

/**
 * 1. Get Featured Testimonials
 * Returns testimonials marked as featured (for about page)
 */
router.get('/featured', async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isFeatured: true }).sort({ createdAt: -1 });
    res.status(200).json({ testimonials });
  } catch (error) {
    console.error("Error fetching featured testimonials:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 2. Get All Testimonials (Admin view)
 */
router.get('/all', async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.status(200).json({ testimonials });
  } catch (error) {
    console.error("Error fetching all testimonials:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 3. Get Testimonials by Feature Used
 */
router.get('/by-feature/:feature', async (req, res) => {
  try {
    const { feature } = req.params;
    const testimonials = await Testimonial.find({ featureUsed: feature, isFeatured: true }).sort({ createdAt: -1 });
    res.status(200).json({ testimonials });
  } catch (error) {
    console.error("Error fetching testimonials by feature:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 4. Add Testimonial (Admin/User)
 */
router.post('/add', async (req, res) => {
  try {
    const { name, initials, story, status, featureUsed, backgroundColor, avatarTextColor } = req.body;

    if (!name || !initials || !story || !featureUsed) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const newTestimonial = new Testimonial({
      name,
      initials,
      story,
      status,
      featureUsed,
      backgroundColor: backgroundColor || '#E3F2FD',
      avatarTextColor: avatarTextColor || '#2196F3'
    });

    await newTestimonial.save();
    res.status(201).json({ message: 'Testimonial added', testimonial: newTestimonial });
  } catch (error) {
    console.error("Error adding testimonial:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 5. Toggle Featured Status
 */
router.put('/toggle-featured/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const testimonial = await Testimonial.findById(id);
    
    if (!testimonial) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    testimonial.isFeatured = !testimonial.isFeatured;
    await testimonial.save();
    res.status(200).json({ message: 'Featured status updated', testimonial });
  } catch (error) {
    console.error("Error updating testimonial:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

/**
 * 6. Delete Testimonial
 */
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Testimonial.findByIdAndDelete(id);
    
    if (!result) {
      return res.status(404).json({ message: 'Testimonial not found' });
    }

    res.status(200).json({ message: 'Testimonial deleted' });
  } catch (error) {
    console.error("Error deleting testimonial:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
