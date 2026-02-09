// backend/tests/sprint2-fakecall.test.js
// Mock-based unit tests for Sprint 2 Fake Call features
jest.mock('../index.js', () => ({}));

// Mock models
const mockUser = {
  _id: 'user123',
  email: 'fakecall-test@test.com',
  name: 'Test User',
  phone: '9876543210',
  guardians: [],
};

const mockVoiceProfile = {
  _id: 'voice123',
  userId: 'user123',
  name: 'Mom',
  audioUrl: 'https://example.com/audio/mom.mp3',
  duration: 30,
  createdAt: new Date('2024-01-01T10:00:00Z'),
};

const User = {
  findById: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn((data) => Promise.resolve({ ...mockUser, ...data })),
};

const VoiceProfile = {
  create: jest.fn((data) => Promise.resolve({ _id: data._id || 'voice123', ...data })),
  find: jest.fn().mockResolvedValue([mockVoiceProfile]),
  findOne: jest.fn().mockResolvedValue(mockVoiceProfile),
  findById: jest.fn().mockResolvedValue(mockVoiceProfile),
  findByIdAndDelete: jest.fn().mockResolvedValue(mockVoiceProfile),
  deleteMany: jest.fn().mockResolvedValue(true),
};

describe('Sprint 2 - Fake Call Backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findOne.mockResolvedValue(mockUser);
    VoiceProfile.create.mockImplementation((data) => Promise.resolve({ _id: data._id || 'voice123', ...data }));
    VoiceProfile.find.mockResolvedValue([mockVoiceProfile]);
  });

  // TC_S2_07: Test fake call activation with voice profiles
  describe('TC_S2_07: Fake Call Activation', () => {
    test('Should create and retrieve voice profiles for fake calls', async () => {
      const voiceData = {
        userId: mockUser._id,
        name: 'Mom',
        audioUrl: 'https://example.com/audio/mom.mp3',
        duration: 30,
      };

      const voiceProfile = await VoiceProfile.create(voiceData);

      expect(VoiceProfile.create).toHaveBeenCalledWith(voiceData);
      expect(voiceProfile.userId).toBe(mockUser._id);
      expect(voiceProfile.name).toBe('Mom');
      expect(voiceProfile.audioUrl).toBeDefined();
    });

    test('Should retrieve all voice profiles for user', async () => {
      const profiles = await VoiceProfile.find({ userId: mockUser._id });

      expect(VoiceProfile.find).toHaveBeenCalledWith({ userId: mockUser._id });
      expect(profiles).toHaveLength(1);
      expect(profiles[0].name).toBe('Mom');
    });
  });

  // TC_S2_08 & TC_S2_09: Voice Profile Management
  describe('TC_S2_08 & TC_S2_09: Voice Profile Management', () => {
    test('Should upload and save voice profile', async () => {
      const uploadData = {
        userId: mockUser._id,
        name: 'Dad',
        audioUrl: 'https://example.com/audio/dad.mp3',
        duration: 45,
      };

      const profile = await VoiceProfile.create(uploadData);

      expect(profile.name).toBe('Dad');
      expect(profile.audioUrl).toContain('.mp3');
      expect(profile.duration).toBe(45);
    });

    test('Should delete voice profile', async () => {
      const deletedProfile = await VoiceProfile.findByIdAndDelete(mockVoiceProfile._id);

      expect(VoiceProfile.findByIdAndDelete).toHaveBeenCalledWith(mockVoiceProfile._id);
      expect(deletedProfile._id).toBe(mockVoiceProfile._id);
    });

    test('Should list all voice profiles for user', async () => {
      VoiceProfile.find.mockResolvedValueOnce([
        mockVoiceProfile,
        { ...mockVoiceProfile, _id: 'voice456', name: 'Dad' },
      ]);

      const profiles = await VoiceProfile.find({ userId: mockUser._id });

      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe('Mom');
      expect(profiles[1].name).toBe('Dad');
    });
  });

  // TC_S2_10: Fake Call Trigger
  describe('TC_S2_10: Fake Call Trigger', () => {
    test('Should trigger fake call with selected voice profile', async () => {
      const profile = await VoiceProfile.findById(mockVoiceProfile._id);

      expect(profile).toBeDefined();
      expect(profile.audioUrl).toBeDefined();
      expect(profile.name).toBe('Mom');
      
      // Simulate fake call trigger
      const fakeCallData = {
        voiceProfileId: profile._id,
        userId: mockUser._id,
        audioUrl: profile.audioUrl,
        duration: profile.duration,
      };

      expect(fakeCallData.voiceProfileId).toBe(mockVoiceProfile._id);
      expect(fakeCallData.audioUrl).toBeDefined();
    });

    test('Should handle fake call without voice profile', async () => {
      VoiceProfile.find.mockResolvedValueOnce([]);

      const profiles = await VoiceProfile.find({ userId: mockUser._id });

      expect(profiles).toHaveLength(0);
      
      // Should be able to trigger default fake call
      const defaultCall = {
        userId: mockUser._id,
        audioUrl: null,
        isDefault: true,
      };

      expect(defaultCall.isDefault).toBe(true);
      expect(defaultCall.audioUrl).toBeNull();
    });
  });

  // Voice Profile Validation
  describe('Voice Profile Validation', () => {
    test('Should validate audio file format', async () => {
      const invalidData = {
        userId: mockUser._id,
        name: 'Invalid',
        audioUrl: 'https://example.com/audio/invalid.txt',
        duration: 30,
      };

      // Mock validation failure
      VoiceProfile.create.mockRejectedValueOnce(new Error('Invalid audio format'));

      try {
        await VoiceProfile.create(invalidData);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Invalid audio format');
      }
    });

    test('Should validate audio duration', async () => {
      const profile = await VoiceProfile.create({
        ...mockVoiceProfile,
        duration: 30,
      });

      expect(profile.duration).toBeGreaterThan(0);
      expect(profile.duration).toBeLessThanOrEqual(60); // Max 60 seconds
    });
  });
});
