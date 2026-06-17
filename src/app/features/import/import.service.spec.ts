import { TestBed } from '@angular/core/testing';
import { ImportService } from './import.service';
import { SupabaseService } from '../../core/supabase.service';
import { AuthService } from '../../core/auth.service';
import { signal } from '@angular/core';

const mockUpload = jest.fn().mockResolvedValue({ data: { path: 'u1/file.json' }, error: null });
const mockFrom = jest.fn();
const mockStorage = { from: jest.fn().mockReturnValue({ upload: mockUpload }) };
const mockSupabase = { client: { from: mockFrom, storage: mockStorage } };
const mockAuth = { user: signal({ id: 'u1' }) };

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthService, useValue: mockAuth },
      ],
    });
    service = TestBed.inject(ImportService);
    jest.clearAllMocks();
  });

  it('uploadFile uploads to storage and creates import_job', async () => {
    const insertMock = jest.fn().mockResolvedValue({
      data: { id: 'j1', status: 'pending', file_path: 'u1/file.json', user_id: 'u1', created_at: '' },
      error: null,
    });
    mockFrom.mockReturnValue({ insert: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: insertMock }) }) });

    const file = new File(['{}'], 'recipe.json', { type: 'application/json' });
    const job = await service.uploadFile(file);

    expect(mockStorage.from).toHaveBeenCalledWith('recipe-imports');
    expect(mockUpload).toHaveBeenCalled();
    expect(job.status).toBe('pending');
  });
});
