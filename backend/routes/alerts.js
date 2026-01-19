import express from 'express';
import { Alert } from '../models/schemas.js';

const router = express.Router();

// Create a new alert (called internally when events happen)
export async function createAlert(alertData) {
  try {
    console.log('Creating alert with data:', alertData);
    const alert = new Alert(alertData);
    await alert.save();
    console.log('Alert created successfully:', { id: alert._id, type: alert.type, userEmail: alert.userEmail });
    return alert;
  } catch (error) {
    console.error('Error creating alert:', error);
    console.error('Alert data that failed:', alertData);
    return null;
  }
}

// GET all alerts for guardians of a specific user
router.get('/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { limit = 50, page = 1, type, isRead, fromDate, toDate } = req.query;

    console.log('Fetching alerts for user:', userEmail);

    // Build filter query
    const filter = { userEmail };
    if (type) filter.type = type;
    if (isRead !== undefined) filter.isRead = isRead === 'true';
    if (fromDate) filter.createdAt = { ...filter.createdAt, $gte: new Date(fromDate) };
    if (toDate) filter.createdAt = { ...filter.createdAt, $lte: new Date(toDate) };

    const alerts = await Alert.find(filter)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalAlerts = await Alert.countDocuments(filter);
    const unreadCount = await Alert.countDocuments({ userEmail, isRead: false });

    console.log(`Found ${alerts.length} alerts for ${userEmail} (Total: ${totalAlerts}, Unread: ${unreadCount})`);

    res.status(200).json({
      alerts,
      pagination: {
        total: totalAlerts,
        unread: unreadCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalAlerts / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Mark alert(s) as read
router.put('/mark-read', async (req, res) => {
  try {
    const { alertIds } = req.body;

    if (!alertIds || !Array.isArray(alertIds)) {
      return res.status(400).json({ message: 'alertIds array is required' });
    }

    await Alert.updateMany(
      { _id: { $in: alertIds } },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({ message: 'Alerts marked as read' });
  } catch (error) {
    console.error('Error marking alerts as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark all alerts as read for a user
router.put('/mark-all-read/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;

    await Alert.updateMany(
      { userEmail, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    res.status(200).json({ message: 'All alerts marked as read' });
  } catch (error) {
    console.error('Error marking all alerts as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete read alerts older than 1 day
router.delete('/cleanup/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const result = await Alert.deleteMany({
      userEmail,
      isRead: true,
      readAt: { $lt: oneDayAgo }
    });

    res.status(200).json({ 
      message: 'Read alerts older than 1 day cleaned up', 
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error cleaning up alerts:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get unread count
router.get('/unread-count/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const count = await Alert.countDocuments({ userEmail, isRead: false });
    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
