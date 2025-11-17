package service

import (
	"time"

	"github.com/google/uuid"
)

// JobStatus представляет статус задачи
type JobStatus string

const (
	StatusPending    JobStatus = "pending"
	StatusProcessing JobStatus = "processing"
	StatusCompleted  JobStatus = "completed"
	StatusFailed     JobStatus = "failed"
)

// Job представляет задачу анализа
type Job struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	Status    JobStatus `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	Error     string    `json:"error,omitempty"`
	Progress  int       `json:"progress"`
}

// NewJob создает новую задачу
func NewJob(url string) *Job {
	now := time.Now()
	return &Job{
		ID:        uuid.New().String(),
		URL:       url,
		Status:    StatusPending,
		CreatedAt: now,
		UpdatedAt: now,
		Progress:  0,
	}
}

// UpdateStatus обновляет статус задачи
func (j *Job) UpdateStatus(status JobStatus) {
	j.Status = status
	j.UpdatedAt = time.Now()
}

// SetError устанавливает ошибку
func (j *Job) SetError(err string) {
	j.Error = err
	j.Status = StatusFailed
	j.UpdatedAt = time.Now()
}

// SetProgress устанавливает прогресс
func (j *Job) SetProgress(progress int) {
	j.Progress = progress
	j.UpdatedAt = time.Now()
}
