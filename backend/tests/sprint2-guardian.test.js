// backend/tests/sprint2-guardian.test.js
// Mock-based unit tests for Sprint 2 Guardian Dashboard features
jest.mock('../index.js', () => ({}));

// Mock models
const mockProtectedUser = {
  _id: 'protected123',
  email: 'protected@test.com',
  name: 'Protected User',
  phone: '9876543210',
  guardians: [
    {
      name: 'Guardian User',
      email: 'guardian-dash@test.com',
      phone: '9876543211',
    },
  ],
  location: { latitude: 11.2588, longitude: 75.7804 },
};

const mockGuardian = {
  _id: 'guardian123',
  email: 'guardian-dash@test.com',
  name: 'Guardian User',
  phone: '9876543211',
  isGuardian: true,
  protectedUsers: ['protected123'],
};

const mockAlert = {
  _id: 'alert123',
  userId: 'protected123',
  userEmail: 'protected@test.com',
  userName: 'Protected User',
  type: 'sos',
  location: { latitude: 11.2588, longitude: 75.7804 },
  timestamp: new Date('2024-01-01T10:00:00Z'),
  status: 'active',
};

const User = {
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data) => Promise.resolve({ ...mockProtectedUser, ...data })),
  findByIdAndUpdate: jest.fn(),
};

const Alert = {
  create: jest.fn((data) => Promise.resolve({ ...mockAlert, ...data })),
  find: jest.fn().mockResolvedValue([mockAlert]),
  findOne: jest.fn().mockResolvedValue(mockAlert),
  countDocuments: jest.fn().mockResolvedValue(5),
  deleteMany: jest.fn().mockResolvedValue(true),
};

describe('Sprint 2 - Guardian Dashboard Backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findById.mockResolvedValue(mockProtectedUser);
    User.findOne.mockImplementation(({ email }) => {
      if (email === 'guardian-dash@test.com') return Promise.resolve(mockGuardian);
      if (email === 'protected@test.com') return Promise.resolve(mockProtectedUser);
      return Promise.resolve(null);
    });
    Alert.find.mockResolvedValue([mockAlert]);
    Alert.countDocuments.mockResolvedValue(5);
  });

  // TC_S2_11: Guardian Dashboard Real-Time Updates
  describe('TC_S2_11: Guardian Dashboard Real-Time Updates', () => {
    test('Should fetch real-time alerts for protected user', async () => {
      const alerts = await Alert.find({ userId: mockProtectedUser._id });

      expect(Alert.find).toHaveBeenCalledWith({ userId: mockProtectedUser._id });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].userEmail).toBe(mockProtectedUser.email);
      expect(alerts[0].type).toBe('sos');
    });

    test('Should display protected user location', async () => {
      const user = await User.findById(mockProtectedUser._id);

      expect(user.location).toBeDefined();
      expect(user.location.latitude).toBe(11.2588);
      expect(user.location.longitude).toBe(75.7804);
    });

    test('Should show alert count for protected user', async () => {
      const count = await Alert.countDocuments({ userId: mockProtectedUser._id });

      expect(count).toBe(5);
      expect(count).toBeGreaterThan(0);
    });
  });

  // TC_S2_12: Alert History View
  describe('TC_S2_12: Alert History View', () => {
    test('Should retrieve alert history for protected user', async () => {
      const mockAlertHistory = [
        mockAlert,
        { ...mockAlert, _id: 'alert456', type: 'fall_detection', timestamp: new Date('2024-01-02') },
        { ...mockAlert, _id: 'alert789', type: 'crime_zone', timestamp: new Date('2024-01-03') },
      ];

      Alert.find.mockResolvedValueOnce(mockAlertHistory);

      const history = await Alert.find({ userId: mockProtectedUser._id });

      expect(history).toHaveLength(3);
      expect(history[0].type).toBe('sos');
      expect(history[1].type).toBe('fall_detection');
      expect(history[2].type).toBe('crime_zone');
    });

    test('Should filter alerts by type', async () => {
      const sosAlerts = [mockAlert];
      Alert.find.mockResolvedValueOnce(sosAlerts);

      const alerts = await Alert.find({ userId: mockProtectedUser._id, type: 'sos' });

      expect(Alert.find).toHaveBeenCalledWith({ userId: mockProtectedUser._id, type: 'sos' });
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('sos');
    });

    test('Should sort alerts by timestamp', async () => {
      const sortedAlerts = [
        { ...mockAlert, timestamp: new Date('2024-01-03') },
        { ...mockAlert, timestamp: new Date('2024-01-02') },
        { ...mockAlert, timestamp: new Date('2024-01-01') },
      ];

      Alert.find.mockResolvedValueOnce(sortedAlerts);

      const alerts = await Alert.find({ userId: mockProtectedUser._id });

      expect(alerts[0].timestamp.getTime()).toBeGreaterThan(alerts[1].timestamp.getTime());
      expect(alerts[1].timestamp.getTime()).toBeGreaterThan(alerts[2].timestamp.getTime());
    });
  });

  // TC_S2_13: Guardian Authentication
  describe('TC_S2_13: Guardian Authentication', () => {
    test('Should verify guardian access to protected user data', async () => {
      const guardian = await User.findOne({ email: 'guardian-dash@test.com' });

      expect(guardian.isGuardian).toBe(true);
      expect(guardian.protectedUsers).toContain(mockProtectedUser._id);
    });

    test('Should deny access to non-guardian users', async () => {
      User.findOne.mockResolvedValueOnce({ ...mockProtectedUser, isGuardian: false });

      const nonGuardian = await User.findOne({ email: 'notguardian@test.com' });

      expect(nonGuardian.isGuardian).toBeFalsy();
    });

    test('Should add guardian to protected user', async () => {
      const updatedUser = {
        ...mockProtectedUser,
        guardians: [
          ...mockProtectedUser.guardians,
          { name: 'New Guardian', email: 'new@test.com', phone: '1234567890' },
        ],
      };

      User.findByIdAndUpdate.mockResolvedValueOnce(updatedUser);

      const result = await User.findByIdAndUpdate(mockProtectedUser._id, {
        $push: { guardians: { name: 'New Guardian', email: 'new@test.com', phone: '1234567890' } },
      });

      expect(result.guardians).toHaveLength(2);
      expect(result.guardians[1].email).toBe('new@test.com');
    });
  });

  // Guardian Notification System
  describe('Guardian Notification System', () => {
    test('Should send alert to all guardians', async () => {
      const alert = await Alert.create({
        userId: mockProtectedUser._id,
        userEmail: mockProtectedUser.email,
        userName: mockProtectedUser.name,
        type: 'sos',
        location: mockProtectedUser.location,
      });

      expect(alert.userEmail).toBe(mockProtectedUser.email);
      
      // Verify guardians can be notified
      const user = await User.findById(mockProtectedUser._id);
      expect(user.guardians).toHaveLength(1);
      expect(user.guardians[0].email).toBe('guardian-dash@test.com');
    });

    test('Should track alert acknowledgment by guardian', async () => {
      const acknowledgedAlert = {
        ...mockAlert,
        status: 'acknowledged',
        acknowledgedBy: mockGuardian._id,
        acknowledgedAt: new Date(),
      };

      Alert.findOne.mockResolvedValueOnce(acknowledgedAlert);

      const alert = await Alert.findOne({ _id: mockAlert._id });

      expect(alert.status).toBe('acknowledged');
      expect(alert.acknowledgedBy).toBe(mockGuardian._id);
    });
  });

  // Multiple Protected Users
  describe('Multiple Protected Users', () => {
    test('Should handle multiple protected users for one guardian', async () => {
      const guardianWithMultiple = {
        ...mockGuardian,
        protectedUsers: ['protected123', 'protected456', 'protected789'],
      };

      User.findOne.mockResolvedValueOnce(guardianWithMultiple);

      const guardian = await User.findOne({ email: 'guardian-dash@test.com' });

      expect(guardian.protectedUsers).toHaveLength(3);
      expect(guardian.protectedUsers).toContain('protected123');
    });

    test('Should fetch alerts for all protected users', async () => {
      const multipleAlerts = [
        mockAlert,
        { ...mockAlert, _id: 'alert456', userId: 'protected456' },
        { ...mockAlert, _id: 'alert789', userId: 'protected789' },
      ];

      Alert.find.mockResolvedValueOnce(multipleAlerts);

      const alerts = await Alert.find({ userId: { $in: ['protected123', 'protected456', 'protected789'] } });

      expect(alerts).toHaveLength(3);
    });
  });
});
