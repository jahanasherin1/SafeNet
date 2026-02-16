import express from 'express';
import mongoose from 'mongoose';
import { Alert } from '../models/schemas.js';

const router = express.Router();

// Create a new alert (called internally when events happen)
export async function createAlert(alertData) {
  try {
    if (!alertData || !alertData.userEmail || !alertData.type) {
      console.error('❌ Invalid alert data:', alertData);
      return null;
    }

    console.log('📝 Creating alert:', {
      userEmail: alertData.userEmail,
      type: alertData.type,
      title: alertData.title
    });

    const alert = new Alert(alertData);
    const savedAlert = await alert.save();
    
    console.log('✅ Alert saved successfully:', {
      id: savedAlert._id,
      type: savedAlert.type,
      userEmail: savedAlert.userEmail,
      createdAt: savedAlert.createdAt
    });
    
    return savedAlert;
  } catch (error) {
    console.error('❌ Error creating alert:', error.message);
    console.error('   Alert data:', alertData);
    console.error('   Error details:', error);
    return null;
  }
}

// GET all alerts for guardians of a specific user
router.get('/user/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { limit = 50, page = 1, type, excludeType, isRead, fromDate, toDate } = req.query;

    console.log('Fetching alerts for user:', userEmail);

    // Build filter query
    const filter = { userEmail };
    if (type) {
      filter.type = type;
    } else if (excludeType) {
      filter.type = { $ne: excludeType };
    }
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

    console.log('📥 Mark-read request received');
    console.log('   alertIds:', alertIds);

    if (!alertIds || !Array.isArray(alertIds)) {
      console.warn('⚠️ Invalid alertIds format');
      return res.status(400).json({ message: 'alertIds array is required', success: false });
    }

    if (alertIds.length === 0) {
      console.log('ℹ️ No alerts to mark as read');
      return res.status(200).json({ message: 'No alerts to mark as read', matched: 0, success: true });
    }

    // Convert string IDs to MongoDB ObjectIds
    let objectIds = [];
    for (const id of alertIds) {
      try {
        objectIds.push(new mongoose.Types.ObjectId(id));
      } catch (e) {
        console.warn(`⚠️ Invalid ObjectId: ${id}`);
      }
    }

    if (objectIds.length === 0) {
      console.error('❌ No valid ObjectIds in the array');
      return res.status(400).json({ message: 'No valid alert IDs provided', success: false });
    }

    console.log(`🔍 Updating ${objectIds.length} alerts...`);
    const result = await Alert.updateMany(
      { _id: { $in: objectIds } },
      { $set: { isRead: true, readAt: new Date() } }
    );

    console.log(`✅ Update complete - Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`);
    res.status(200).json({ 
      message: 'Alerts marked as read', 
      matched: result.matchedCount, 
      modified: result.modifiedCount,
      success: true
    });
  } catch (error) {
    console.error('❌ Error marking alerts as read:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({ message: 'Server error', error: error.message, success: false });
  }
});

// Mark all alerts as read for a user
router.put('/mark-all-read/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;

    console.log(`📥 Mark-all-read request for user: ${userEmail}`);

    const result = await Alert.updateMany(
      { userEmail, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    console.log(`✅ Marked ${result.modifiedCount} alerts as read for ${userEmail}`);
    res.status(200).json({ message: 'All alerts marked as read', modified: result.modifiedCount, success: true });
  } catch (error) {
    console.error('❌ Error marking all alerts as read:', error.message);
    res.status(500).json({ message: 'Server error', error: error.message, success: false });
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
