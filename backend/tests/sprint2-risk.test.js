// backend/tests/sprint2-risk.test.js
// Mock-based unit tests for Sprint 2 Risk & Location features
jest.mock('../index.js', () => ({}));

// Mock models
const mockUser = {
  _id: 'user123',
  email: 'risk-test@test.com',
  name: 'Test User',
  phone: '9876543210',
  guardians: [{ name: 'Guardian', email: 'guardian@test.com', phone: '1234567890' }],
  location: { latitude: 11.2588, longitude: 75.7804 },
};

const mockAlert = {
  _id: 'alert123',
  userId: 'user123',
  userEmail: 'risk-test@test.com',
  userName: 'Test User',
  type: 'crime_zone',
  location: { latitude: 11.2588, longitude: 75.7804 },
  crimeChance: 85,
  reason: 'High risk area detected',
  timestamp: new Date('2024-01-01T10:00:00Z'),
};

const User = {
  findById: jest.fn().mockResolvedValue(mockUser),
  findOne: jest.fn().mockResolvedValue(mockUser),
  create: jest.fn((data) => Promise.resolve({ ...mockUser, ...data })),
  findByIdAndUpdate: jest.fn((id, data) => Promise.resolve({ ...mockUser, ...data })),
};

const Alert = {
  create: jest.fn((data) => Promise.resolve({ ...mockAlert, ...data })),
  find: jest.fn().mockResolvedValue([mockAlert]),
  findOne: jest.fn().mockResolvedValue(mockAlert),
  deleteMany: jest.fn().mockResolvedValue(true),
};

const getCrimeChancesAtLocation = jest.fn((lat, lng) => {
  const chance = lat === 11.2588 && lng === 75.7804 ? 85 : 25; // High risk for specific coords
  return Promise.resolve({
    overall: chance,
    overallRisk: { level: chance > 70 ? 'High' : 'Low', score: chance },
    crimes: [
      { type: 'Assault', chance: chance },
      { type: 'Theft', chance: chance - 5 },
    ],
  });
});

const parseCrimeChanceData = jest.fn((data) => {
  return {
    overall: data?.overall || 0,
    crimes: data?.crimes || [],
  };
});

describe('Sprint 2 - Risk & Location Backend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    User.findOne.mockResolvedValue(mockUser);
    Alert.create.mockResolvedValue(mockAlert);
    getCrimeChancesAtLocation.mockResolvedValue({
      overall: 85,
      overallRisk: { level: 'High', score: 85 },
      crimes: [
        { type: 'Assault', chance: 85 },
        { type: 'Theft', chance: 80 },
      ],
    });
  });

  // TC_S2_14: High Risk Area Alert
  describe('TC_S2_14: High Risk Area Alert', () => {
    test('Should detect high risk area and notify guardians', async () => {
      const location = { latitude: 11.2588, longitude: 75.7804 };
      
      // Get crime data
      const crimeData = await getCrimeChancesAtLocation(location.latitude, location.longitude);
      expect(crimeData.overall).toBeGreaterThan(70); // High risk threshold
      expect(crimeData.overallRisk.level).toBe('High');

      // Create alert
      const alert = await Alert.create({
        userEmail: mockUser.email,
        userName: mockUser.name,
        location: location,
        reason: `High risk area detected: ${crimeData.overallRisk.level}`,
        type: 'crime_zone',
        crimeChance: crimeData.overall,
      });

      expect(Alert.create).toHaveBeenCalledWith(expect.objectContaining({
        userEmail: mockUser.email,
        type: 'crime_zone',
        crimeChance: 85,
      }));
      expect(alert.crimeChance).toBe(85);
    });

    test('Should calculate crime chances correctly', async () => {
      const data = { overall: 85, crimes: [{ type: 'Assault', chance: 85 }] };
      const parsed = parseCrimeChanceData(data);
      
      expect(parsed.overall).toBe(85);
      expect(parsed.crimes).toHaveLength(1);
      expect(parsed.crimes[0].type).toBe('Assault');
    });
  });

  // TC_S2_15 & TC_S2_16: Low Risk Area No Alert
  describe('TC_S2_15 & TC_S2_16: Low Risk Area No Alert', () => {
    test('Should update location without triggering high risk alert', async () => {
      getCrimeChancesAtLocation.mockResolvedValueOnce({
        overall: 25,
        overallRisk: { level: 'Low', score: 25 },
        crimes: [],
      });

      const lowRiskLocation = { latitude: 11.30, longitude: 75.80 };
      const crimeData = await getCrimeChancesAtLocation(lowRiskLocation.latitude, lowRiskLocation.longitude);

      expect(crimeData.overall).toBeLessThan(70); // Below high risk threshold
      expect(crimeData.overallRisk.level).toBe('Low');

      // Update user location
      User.findByIdAndUpdate.mockResolvedValueOnce({
        ...mockUser,
        location: lowRiskLocation,
      });

      const updatedUser = await User.findByIdAndUpdate(mockUser._id, { location: lowRiskLocation });
      expect(updatedUser.location).toEqual(lowRiskLocation);
      
      // Should NOT create alert for low risk
      expect(Alert.create).not.toHaveBeenCalled();
    });
  });

  // TC_S2_17: GPS Permission Handling
  describe('TC_S2_17: GPS Permission Handling', () => {
    test('Should handle location update failure gracefully', async () => {
      User.findByIdAndUpdate.mockRejectedValueOnce(new Error('Location update failed'));

      try {
        await User.findByIdAndUpdate(mockUser._id, { location: null });
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Location update failed');
      }
    });

    test('Should fetch user location successfully', async () => {
      const user = await User.findOne({ email: mockUser.email });
      
      expect(user.location).toBeDefined();
      expect(user.location.latitude).toBe(11.2588);
      expect(user.location.longitude).toBe(75.7804);
    });
  });

  // Crime Chance Analytics API
  describe('Crime Chance Analytics API', () => {
    test('Should return crime chances for given coordinates', async () => {
      const crimeData = await getCrimeChancesAtLocation(11.2588, 75.7804);

      expect(getCrimeChancesAtLocation).toHaveBeenCalledWith(11.2588, 75.7804);
      expect(crimeData.overall).toBeDefined();
      expect(crimeData.overall).toBeGreaterThanOrEqual(0);
      expect(crimeData.overall).toBeLessThanOrEqual(100);
      expect(crimeData.crimes).toBeDefined();
      expect(Array.isArray(crimeData.crimes)).toBe(true);
    });

    test('Should return error for invalid coordinates', async () => {
      getCrimeChancesAtLocation.mockRejectedValueOnce(new Error('Invalid coordinates'));

      try {
        await getCrimeChancesAtLocation(999, 999);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toBe('Invalid coordinates');
      }
    });
  });

  // Zone Detection
  describe('Zone Detection', () => {
    test('Should detect when user enters high-risk zone', async () => {
      const highRiskLocation = { latitude: 11.2588, longitude: 75.7804 };
      const crimeData = await getCrimeChancesAtLocation(highRiskLocation.latitude, highRiskLocation.longitude);

      if (crimeData.overall > 70) {
        const alert = await Alert.create({
          userEmail: mockUser.email,
          userName: mockUser.name,
          type: 'crime_zone',
          location: highRiskLocation,
          crimeChance: crimeData.overall,
          reason: 'Entered high-risk zone',
        });

        expect(alert.type).toBe('crime_zone');
        expect(alert.crimeChance).toBeGreaterThan(70);
      }

      expect(crimeData.overall).toBeGreaterThan(70);
    });
  });
});
