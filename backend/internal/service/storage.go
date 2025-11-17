package service

import (
	"fmt"
	"sync"

	"github.com/danil/accessibility-analyzer/internal/domain"
)

// Storage представляет хранилище для задач и отчетов
type Storage struct {
	jobs    map[string]*Job
	reports map[string]*domain.Report
	mu      sync.RWMutex
}

// NewStorage создает новое хранилище
func NewStorage() *Storage {
	return &Storage{
		jobs:    make(map[string]*Job),
		reports: make(map[string]*domain.Report),
	}
}

// SaveJob сохраняет задачу
func (s *Storage) SaveJob(job *Job) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.jobs[job.ID] = job
	return nil
}

// GetJob получает задачу по ID
func (s *Storage) GetJob(id string) (*Job, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	job, exists := s.jobs[id]
	if !exists {
		return nil, fmt.Errorf("job not found")
	}
	return job, nil
}

// DeleteJob удаляет задачу
func (s *Storage) DeleteJob(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.jobs, id)
	delete(s.reports, id)
	return nil
}

// SaveReport сохраняет отчет
func (s *Storage) SaveReport(report *domain.Report) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports[report.ID] = report
	return nil
}

// GetReport получает отчет по ID
func (s *Storage) GetReport(id string) (*domain.Report, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	report, exists := s.reports[id]
	if !exists {
		return nil, fmt.Errorf("report not found")
	}
	return report, nil
}
