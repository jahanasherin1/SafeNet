import express from 'express';
import { User } from '../models/schemas.js';
import sendEmail from '../utils/sendEmail.js';

const router = express.Router();

// 4. Add Guardian
router.post('/add', async (req, res) => {
  try {
    const { userEmail, name, phone, relationship, guardianEmail } = req.body;

    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const accessCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.guardians.push({ 
        name, phone, relationship, email: guardianEmail, accessCode 
    });
    
    await user.save();

    if (guardianEmail) {
        const emailSubject = "You have been added as a SafeNet Guardian";
        const emailBody = `Hello ${name},\n\n${user.name} has trusted you to be their Safety Guardian.\n\nPhone: ${phone}\nCode: ${accessCode}\n\nStay Safe.`;
        await sendEmail(guardianEmail, emailSubject, emailBody);
    }

    console.log(`Guardian ${name} added.`);
    res.status(200).json({ message: 'Guardian added', guardians: user.guardians });

  } catch (error) {
    console.error("Add Guardian Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// 6. Get All Guardians
router.post('/all', async (req, res) => {
  try {
    const { userEmail } = req.body;
    const user = await User.findOne({ email: userEmail });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json({ guardians: user.guardians });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 7. Update Guardian
router.put('/update', async (req, res) => {
  try {
    const { userEmail, guardianId, name, phone, relationship, email } = req.body;
    const result = await User.updateOne(
      { email: userEmail, "guardians._id": guardianId },
      { 
        $set: {
          "guardians.$.name": name,
          "guardians.$.phone": phone,
          "guardians.$.email": email,
          "guardians.$.relationship": relationship
        }
      }
    );
    if (result.modifiedCount === 0) return res.status(404).json({ message: 'Not found' });
    res.status(200).json({ message: 'Updated' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// 8. Delete Guardian
router.delete('/delete', async (req, res) => {
  try {
    const { userEmail, guardianId } = req.body;
    await User.updateOne(
      { email: userEmail },
      { $pull: { guardians: { _id: guardianId } } }
    );
    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
});

// Get All Users for Guardian
router.post('/all-users', async (req, res) => {
  try {
    const { guardianEmail } = req.body;

    if (!guardianEmail) {
      return res.status(400).json({ message: 'Guardian email is required.' });
    }

    const users = await User.find({ "guardians.email": guardianEmail });

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No users found for this guardian.' });
    }

    const usersData = users.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profileImage: user.profileImage,
      sosActive: user.sosActive,
      lastSosTime: user.lastSosTime,
      currentLocation: user.currentLocation
    }));

    res.status(200).json({ 
      message: 'Users retrieved successfully',
      users: usersData,
      totalUsers: usersData.length
    });

  } catch (error) {
    console.error("Get Guardian Users Error:", error);
    res.status(500).json({ message: 'Server Error' });
  }
});

export default router;
